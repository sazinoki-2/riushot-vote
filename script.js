// Config
const TOKEN_ADDRESS = '0x4989e24fEC5E3bb2De5d67C078e5a28c37681cB9';
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

// State
let proposals = [];
let userAddress = null;
let userBalance = 0;
let provider = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be ready
    const checkFirebase = setInterval(() => {
        if (window.firebaseDB) {
            clearInterval(checkFirebase);
            loadProposals();

            // Check if wallet was previously connected
            if (localStorage.getItem('walletConnected') === 'true') {
                connectWallet();
            }
        }
    }, 100);
});

// Data Management - Firebase
function loadProposals() {
    const proposalsRef = window.firebaseRef(window.firebaseDB, 'proposals');

    window.firebaseOnValue(proposalsRef, (snapshot) => {
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

function createProposal(title, description) {
    const deadlineDate = new Date();
    deadlineDate.setHours(deadlineDate.getHours() + 120); // Exactly 120 hours from now

    const newProposal = {
        title,
        description,
        creator: userAddress,
        createdAt: new Date().toISOString(),
        deadline: deadlineDate.toISOString(),
        votes: { for: 0, against: 0, abstain: 0 },
        votedUsers: []
    };

    // Push to Firebase
    const proposalsRef = window.firebaseRef(window.firebaseDB, 'proposals');
    window.firebasePush(proposalsRef, newProposal);

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
function vote(id, option) {
    if (!userAddress) {
        alert("投票するにはウォレットを接続してください。");
        return;
    }

    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return;

    if (proposal.votedUsers && proposal.votedUsers.includes(userAddress)) {
        alert("既にこの提案に投票済みです。");
        return;
    }

    // Initialize abstain if not present (migration for old data)
    if (!proposal.votes.abstain) proposal.votes.abstain = 0;

    // Get user's token balance for weighted voting
    const voteWeight = parseFloat(userBalance) || 0;

    if (voteWeight <= 0) {
        alert("投票するにはRDGTトークンが必要です。");
        return;
    }

    // Update vote count with weighted balance
    proposal.votes[option] = (proposal.votes[option] || 0) + voteWeight;

    // Track user
    if (!proposal.votedUsers) proposal.votedUsers = [];
    proposal.votedUsers.push(userAddress);

    // Update Firebase
    const proposalRef = window.firebaseRef(window.firebaseDB, `proposals/${id}`);
    window.firebaseUpdate(proposalRef, {
        votes: proposal.votes,
        votedUsers: proposal.votedUsers
    });
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
        const forPercent = total === 0 ? 0 : Math.round((votesFor / total) * 100);
        const againstPercent = total === 0 ? 0 : Math.round((votesAgainst / total) * 100);
        const abstainPercent = total === 0 ? 0 : Math.round((votesAbstain / total) * 100);

        const hasVoted = p.votedUsers && userAddress && p.votedUsers.includes(userAddress);

        return `
            <div class="proposal-card">
                <div class="proposal-header">
                    <span class="proposal-status ${isExpired ? 'closed' : 'active'}">${isExpired ? '終了' : 'Active'}</span>
                    <span style="color:var(--text-secondary); font-size:12px">投票期限 ${deadlineText}</span>
                </div>
                <h3 class="proposal-title">${p.title}</h3>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">
                    提案者: ${creator}
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
                ${isExpired ? `
                    <div style="margin-top:15px; font-size:14px; color:var(--text-secondary); text-align:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px;">
                        投票期間が終了しました
                    </div>
                ` : (!hasVoted ? `
                    <div class="vote-options">
                        <button class="vote-btn" onclick="vote('${p.id}', 'for')">賛成</button>
                        <button class="vote-btn" onclick="vote('${p.id}', 'against')">反対</button>
                        <button class="vote-btn" onclick="vote('${p.id}', 'abstain')" style="border-color: #888; color: #ccc;">棄権</button>
                    </div>
                ` : `
                    <div style="margin-top:15px; font-size:14px; color:var(--text-secondary); text-align:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px;">
                        投票済み
                    </div>
                `)}
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

        // Disable submit if over limit (shouldn't happen with maxlength, but just in case)
        if (titleLen > 30 || descLen > 140) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
        } else {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    }

    titleInput.addEventListener('input', updateCounters);
    descInput.addEventListener('input', updateCounters);
    updateCounters();
}

function closeModal() {
    document.getElementById('create-modal').style.display = 'none';
    document.getElementById('p-title').value = '';
    document.getElementById('p-desc').value = '';

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

// Global expose
window.connectWallet = connectWallet;
window.vote = vote;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleSubmitProposal = handleSubmitProposal;
