// Firebase imports (module-scoped, not exposed to window)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, push, onValue, update } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyApIM3BiyhfvKq-3FBQ-BriQKjvAKOLTLM",
    authDomain: "riudao-vote.firebaseapp.com",
    databaseURL: "https://riudao-vote-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "riudao-vote",
    storageBucket: "riudao-vote.firebasestorage.app",
    messagingSenderId: "898511253134",
    appId: "1:898511253134:web:cc02f464974e0b2c8763df"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Config
const TOKEN_ADDRESS = '0x4989e24fEC5E3bb2De5d67C078e5a28c37681cB9';
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function getPastVotes(address account, uint256 blockNumber) view returns (uint256)",
    "function delegates(address account) view returns (address)",
    "function delegate(address delegatee)"
];

// State
let proposals = [];
let userAddress = null;
let userBalance = 0;
let provider = null;

// Initialize (modules are deferred, DOM is ready when this runs)
document.addEventListener('DOMContentLoaded', () => {
    loadProposals();
    if (localStorage.getItem('walletConnected') === 'true') {
        connectWallet();
    }
});

// Data Management - Firebase
function loadProposals() {
    const proposalsRef = ref(database, 'proposals');

    onValue(proposalsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Convert Firebase object to array and sort by creation time
            proposals = Object.keys(data).map(key => ({
                ...data[key],
                id: key
            })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            proposals = [];
        }
        renderProposals();
    });
}

function saveProposals() {
    // No longer needed - Firebase auto-syncs
    renderProposals();
}

async function createProposal(title, description) {
    const deadlineDate = new Date();
    deadlineDate.setHours(deadlineDate.getHours() + 120); // Exactly 120 hours from now

    // スナップショットブロック（提案作成時点）を記録
    let snapshotBlock = null;
    try {
        snapshotBlock = await provider.getBlockNumber();
    } catch (e) {
        console.warn("snapshotBlock取得失敗:", e);
    }

    const newProposal = {
        title,
        description,
        creator: userAddress,
        createdAt: new Date().toISOString(),
        deadline: deadlineDate.toISOString(),
        snapshotBlock: snapshotBlock,
        votes: { for: 0, against: 0, abstain: 0 }
    };

    // Push to Firebase
    const proposalsRef = ref(database, 'proposals');
    push(proposalsRef, newProposal);

    closeModal();
}

// Wallet Logic
async function connectWallet() {
    const btn = document.getElementById('connect-btn');
    btn.innerText = "Connecting...";

    try {
        // Check if mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            // Mobile: Use MetaMask deeplink
            if (typeof window.ethereum === 'undefined') {
                // MetaMask app not detected, open deeplink
                const currentUrl = window.location.href;
                const metamaskDeeplink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;

                // Redirect to MetaMask app
                window.location.href = metamaskDeeplink;

                // Show message
                alert("MetaMaskアプリを開いています...");
                return;
            }
        } else {
            // Desktop: Check for MetaMask extension
            if (typeof window.ethereum === 'undefined') {
                alert("MetaMaskがインストールされていません。この機能を使用するにはインストールしてください。");
                btn.innerText = "Connect Wallet";
                return;
            }
        }

        // Connect via MetaMask (works on both mobile app and desktop extension)
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        userAddress = accounts[0];

        localStorage.setItem('walletConnected', 'true');

        await updateBalance();
        updateWalletUI();

        // 初回デリゲートチェック（未デリゲートなら自動TX）
        await checkAndDelegate();

    } catch (error) {
        console.error(error);
        // data checks for common user rejection codes (4001 is standard EIP-1193 user rejected request)
        if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
            alert("接続がキャンセルされました。");
        } else {
            alert("接続に失敗しました: " + (error.message || "不明なエラー"));
        }
        btn.innerText = "Connect Wallet";
    }
}

async function checkAndDelegate() {
    if (!userAddress || !provider) return;
    console.log("[delegate] checkAndDelegate 開始, userAddress:", userAddress);
    try {
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        const currentDelegate = await contract.delegates(userAddress);
        console.log("[delegate] 現在のdelegate先:", currentDelegate);
        // 自分自身へのデリゲートが未完了の場合のみTXを送信
        if (currentDelegate.toLowerCase() !== userAddress.toLowerCase()) {
            console.log("[delegate] 未デリゲート → TX送信へ");
            alert("投票権を有効にするため、一度だけMetaMaskで署名が必要です（デリゲート）。\nガス代は数円程度です。");
            const tx = await contract.delegate(userAddress);
            await tx.wait();
            alert("デリゲート完了！これ以降は追加の署名は不要です。");
        } else {
            console.log("[delegate] 既にself-delegate済み → スキップ");
        }
    } catch (e) {
        console.warn("[delegate] エラー:", e.code, e.message);
        // ユーザーがキャンセルした場合は無視
        if (e.code !== 4001 && e.code !== 'ACTION_REJECTED') {
            console.warn("delegate check error:", e);
        }
    }
}

async function updateBalance() {
    if (!userAddress) return;
    try {
        const contract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
        const decimals = await contract.decimals().catch(() => 18);
        const rawBalance = await contract.balanceOf(userAddress);
        const formatted = ethers.formatUnits(rawBalance, decimals);
        userBalance = parseFloat(formatted).toFixed(2);
    } catch (e) {
        console.error("Balance fetch error:", e);
        userBalance = "---";
    }
}

function updateWalletUI() {
    const btn = document.getElementById('connect-btn');
    const stats = document.getElementById('wallet-stats');
    const addr = document.getElementById('wallet-address');
    const bal = document.getElementById('wallet-balance');
    const createBtn = document.getElementById('create-btn');

    btn.style.display = 'none';
    stats.style.display = 'block';

    // Shorten address
    const shortAddr = userAddress.substring(0, 6) + "..." + userAddress.substring(userAddress.length - 4);
    addr.innerText = shortAddr;
    bal.innerText = `${userBalance} RDGT`;

    // Enable create button if connected
    if (createBtn) createBtn.disabled = false;
}

// Voting Logic
async function vote(id, option) {
    if (!userAddress) {
        alert("投票するにはウォレットを接続してください。");
        return;
    }

    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return;

    // Check if already voted (supports both old array and new object format)
    const votedUsers = proposal.votedUsers || {};
    const alreadyVoted = Array.isArray(votedUsers)
        ? (votedUsers.includes(userAddress) || votedUsers.includes(userAddress.toLowerCase()))
        : votedUsers[userAddress.toLowerCase()];
    if (alreadyVoted) {
        alert("既にこの提案に投票済みです。");
        return;
    }

    // Initialize abstain if not present (migration for old data)
    if (!proposal.votes.abstain) proposal.votes.abstain = 0;

    // 投票ウェイト取得
    // snapshotBlock があればgetPastVotes（スナップショット方式）、なければbalanceOf（旧提案フォールバック）
    let voteWeight = 0;
    try {
        const contract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
        const decimals = await contract.decimals().catch(() => 18);
        if (proposal.snapshotBlock) {
            const rawVotes = await contract.getPastVotes(userAddress, proposal.snapshotBlock);
            voteWeight = parseFloat(ethers.formatUnits(rawVotes, decimals));
        } else {
            // 旧提案：リアルタイム残高で代替
            const rawBalance = await contract.balanceOf(userAddress);
            voteWeight = parseFloat(ethers.formatUnits(rawBalance, decimals));
        }
    } catch (e) {
        console.error("投票ウェイト取得エラー:", e);
        voteWeight = 0;
    }

    if (voteWeight <= 0) {
        if (proposal.snapshotBlock) {
            alert("この提案の作成時点（スナップショット）でRDGTを保有していないか、デリゲートが完了していません。");
        } else {
            alert("投票するにはRDGTトークンが必要です。");
        }
        return;
    }

    // Update vote count with weighted balance
    proposal.votes[option] = (proposal.votes[option] || 0) + voteWeight;

    // Update Firebase with multi-path update
    // votedUsers/{address} is protected by Firebase rules: write only if !data.exists()
    const proposalRef = ref(database, `proposals/${id}`);
    const updates = {};
    updates['votes'] = proposal.votes;
    updates[`votedUsers/${userAddress.toLowerCase()}`] = true;
    try {
        await update(proposalRef, updates);
    } catch (e) {
        console.error("投票書き込みエラー:", e);
        alert("投票に失敗しました。既に投票済みか、通信エラーの可能性があります。");
    }
}

// UI Rendering
function renderProposals() {
    const container = document.getElementById('proposals-container');

    if (proposals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No active proposals</h3>
                <p>Be the first to create a proposal for the community.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = proposals.map(p => {
        // Migration for missing fields
        const votesFor = p.votes.for || 0;
        const votesAgainst = p.votes.against || 0;
        const votesAbstain = p.votes.abstain || 0;
        const creator = p.creator ? (p.creator.substring(0, 6) + "..." + p.creator.substring(p.creator.length - 4)) : "Unknown";

        let deadlineText = "----/--/-- --:--";
        let deadlineDate = null;

        if (p.deadline) {
            deadlineDate = new Date(p.deadline);
            deadlineText = `${deadlineDate.getFullYear()}/${(deadlineDate.getMonth() + 1).toString().padStart(2, '0')}/${deadlineDate.getDate().toString().padStart(2, '0')} ${deadlineDate.getHours().toString().padStart(2, '0')}:${deadlineDate.getMinutes().toString().padStart(2, '0')}`;
        } else if (p.createdAt) {
            // Fallback for old items: +120 hours (5 days) from creation
            deadlineDate = new Date(p.createdAt);
            deadlineDate.setHours(deadlineDate.getHours() + 120);
            deadlineText = `${deadlineDate.getFullYear()}/${(deadlineDate.getMonth() + 1).toString().padStart(2, '0')}/${deadlineDate.getDate().toString().padStart(2, '0')} ${deadlineDate.getHours().toString().padStart(2, '0')}:${deadlineDate.getMinutes().toString().padStart(2, '0')}`;
        }

        // Check if voting period has ended
        const now = new Date();
        const isExpired = deadlineDate && now > deadlineDate;

        const total = votesFor + votesAgainst + votesAbstain;
        const uniqueVoters = p.votedUsers
            ? (Array.isArray(p.votedUsers) ? p.votedUsers.length : Object.keys(p.votedUsers).length)
            : 0;

        // Quorum Check: 50,000 votes AND 5 unique wallets
        const isQuorumMet = total >= 50000 && uniqueVoters >= 5;

        const forPercent = total === 0 ? 0 : Math.round((votesFor / total) * 100);
        const againstPercent = total === 0 ? 0 : Math.round((votesAgainst / total) * 100);
        const abstainPercent = total === 0 ? 0 : Math.round((votesAbstain / total) * 100);

        const hasVoted = p.votedUsers && userAddress && (
            Array.isArray(p.votedUsers)
                ? (p.votedUsers.includes(userAddress) || p.votedUsers.includes(userAddress.toLowerCase()))
                : p.votedUsers[userAddress.toLowerCase()]
        );

        // Determine Status Badge
        let statusBadge = '';
        if (isExpired) {
            if (isQuorumMet) {
                statusBadge = '<span class="proposal-status closed">終了</span>';
            } else {
                statusBadge = '<span class="proposal-status invalid">無効</span>';
            }
        } else {
            statusBadge = '<span class="proposal-status active">Active</span>';
        }

        // Determine Action Area
        let actionArea = '';
        if (isExpired) {
            if (isQuorumMet) {
                actionArea = `
                    <div style="margin-top:15px; font-size:14px; color:var(--text-secondary); text-align:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px;">
                        投票期間が終了しました
                    </div>
                `;
            } else {
                actionArea = `
                    <div style="margin-top:15px; font-size:14px; color:var(--text-secondary); text-align:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px;">
                        Quorum Not Met (ウォレット接続数/投票数が要件未達)
                    </div>
                `;
            }
        } else {
            if (!hasVoted) {
                actionArea = `
                    <div class="vote-options">
                        <button class="vote-btn" onclick="vote('${p.id}', 'for')">賛成</button>
                        <button class="vote-btn" onclick="vote('${p.id}', 'against')">反対</button>
                        <button class="vote-btn" onclick="vote('${p.id}', 'abstain')" style="border-color: #888; color: #ccc;">棄権</button>
                    </div>
                `;
            } else {
                actionArea = `
                    <div style="margin-top:15px; font-size:14px; color:var(--text-secondary); text-align:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px;">
                        投票済み
                    </div>
                `;
            }
        }

        return `
            <div class="proposal-card">
                <div class="proposal-header">
                    ${statusBadge}
                    <span style="color:var(--text-secondary); font-size:12px">投票期限 ${deadlineText}</span>
                </div>
                <h3 class="proposal-title">${p.title}</h3>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">
                    提案者: ${creator}
                    <span style="margin-left: 10px; opacity: 0.8;">(現在の参加: ${uniqueVoters}名 / Total: ${total.toLocaleString()} RDGT)</span>
                </div>
                <p class="proposal-desc">${p.description}</p>
                
                <!-- Results -->
                <div class="result-row">
                    <div class="result-meta">
                        <span>賛成</span>
                        <span>${votesFor.toLocaleString()} RDGT (${forPercent}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${forPercent}%; background-color: var(--accent-color)"></div>
                    </div>
                </div>
                
                <div class="result-row">
                    <div class="result-meta">
                        <span>反対</span>
                        <span>${votesAgainst.toLocaleString()} RDGT (${againstPercent}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${againstPercent}%; background-color: var(--danger-color)"></div>
                    </div>
                </div>

                <div class="result-row">
                    <div class="result-meta">
                        <span>棄権</span>
                        <span>${votesAbstain.toLocaleString()} RDGT (${abstainPercent}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${abstainPercent}%; background-color: #888"></div>
                    </div>
                </div>

                <!-- Actions -->
                ${actionArea}
            </div>
        `;
    }).join('');
}

// Modal handling
function openModal() {
    if (!userAddress) {
        alert("Please connect wallet first.");
        return;
    }

    // Check balance
    const currentBalance = parseFloat(userBalance);
    if (isNaN(currentBalance) || currentBalance < 2500) {
        alert("提案を作成するには、最低2500 RDGTが必要です。");
        return;
    }

    document.getElementById('create-modal').style.display = 'flex';

    // Setup character counters
    const titleInput = document.getElementById('p-title');
    const descInput = document.getElementById('p-desc');
    const titleCounter = document.getElementById('title-counter');
    const descCounter = document.getElementById('desc-counter');
    const submitBtn = document.getElementById('submit-proposal-btn');

    function updateCounters() {
        const titleLen = titleInput.value.length;
        const descLen = descInput.value.length;

        titleCounter.textContent = `(${titleLen}/30)`;
        descCounter.textContent = `(${descLen}/140)`;

        // Change color if approaching limit
        titleCounter.style.color = titleLen > 25 ? '#cf222e' : 'var(--text-secondary)';
        descCounter.style.color = descLen > 130 ? '#cf222e' : 'var(--text-secondary)';

        // ボタン制御はupdateSubmitBtnに委譲
        updateSubmitBtn();
    }

    titleInput.addEventListener('input', updateCounters);
    descInput.addEventListener('input', updateCounters);

    // 初期状態：チェックリセット → 公開ボタン無効
    const checkbox = document.getElementById('terms-checkbox');
    checkbox.checked = false;
    updateCounters();
}

function updateSubmitBtn() {
    const titleVal = document.getElementById('p-title').value.trim();
    const descVal = document.getElementById('p-desc').value.trim();
    const titleLen = document.getElementById('p-title').value.length;
    const descLen = document.getElementById('p-desc').value.length;
    const isChecked = document.getElementById('terms-checkbox').checked;
    const submitBtn = document.getElementById('submit-proposal-btn');

    // 3条件すべて満たす場合のみ有効
    const isValid = titleVal.length > 0 && descVal.length > 0 && isChecked && titleLen <= 30 && descLen <= 140;
    submitBtn.disabled = !isValid;
    submitBtn.style.opacity = isValid ? '1' : '0.5';
}

function closeModal() {
    document.getElementById('create-modal').style.display = 'none';
    document.getElementById('p-title').value = '';
    document.getElementById('p-desc').value = '';
    document.getElementById('terms-checkbox').checked = false;

    // Reset counters
    document.getElementById('title-counter').textContent = '(0/30)';
    document.getElementById('desc-counter').textContent = '(0/140)';
    document.getElementById('title-counter').style.color = 'var(--text-secondary)';
    document.getElementById('desc-counter').style.color = 'var(--text-secondary)';
}

function handleSubmitProposal() {
    const title = document.getElementById('p-title').value.trim();
    const desc = document.getElementById('p-desc').value.trim();

    if (!title || !desc) {
        alert("タイトルと提案内容を入力してください。");
        return;
    }

    if (title.length > 30) {
        alert("タイトルは30文字以内で入力してください。");
        return;
    }

    if (desc.length > 140) {
        alert("提案内容は140文字以内で入力してください。");
        return;
    }

    createProposal(title, desc);
}

// Global expose (UI onclick handlers only - Firebase functions are NOT exposed)
window.connectWallet = connectWallet;
window.vote = vote;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleSubmitProposal = handleSubmitProposal;
window.updateSubmitBtn = updateSubmitBtn;
