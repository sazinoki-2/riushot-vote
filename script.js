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
    loadProposals();
    renderProposals();

    // Check if wallet was previously connected
    if (localStorage.getItem('walletConnected') === 'true') {
        connectWallet();
    }
});

// Data Management
function loadProposals() {
    const saved = localStorage.getItem('vote_proposals');
    if (saved) {
        proposals = JSON.parse(saved);
    } else {
        proposals = []; // Start EMPTY as requested
    }
}

function saveProposals() {
    localStorage.setItem('vote_proposals', JSON.stringify(proposals));
    renderProposals();
}

function createProposal(title, description) {
    const newProposal = {
        id: Date.now().toString(),
        title,
        description,
        createdAt: new Date().toISOString(),
        votes: { for: 0, against: 0 },
        votedUsers: [] // Track who voted to prevent double voting locally
    };
    proposals.unshift(newProposal); // Add to top
    saveProposals();
    closeModal();
}

// Wallet Logic
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert("MetaMask is not installed. Please install it to use this feature.");
        return;
    }

    try {
        const btn = document.getElementById('connect-btn');
        btn.innerText = "Connecting...";

        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        userAddress = accounts[0];

        localStorage.setItem('walletConnected', 'true');

        await updateBalance();
        updateWalletUI();

    } catch (error) {
        console.error(error);
        alert("Connection failed: " + error.message);
        document.getElementById('connect-btn').innerText = "Connect Wallet";
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
    bal.innerText = `${userBalance} Tokens`;

    // Enable create button if connected
    if (createBtn) createBtn.disabled = false;
}

// Voting Logic
function vote(id, option) {
    if (!userAddress) {
        alert("Please connect your wallet to vote.");
        return;
    }

    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return;

    if (proposal.votedUsers && proposal.votedUsers.includes(userAddress)) {
        alert("You have already voted on this proposal.");
        return;
    }

    // Update vote
    proposal.votes[option]++;

    // Track user
    if (!proposal.votedUsers) proposal.votedUsers = [];
    proposal.votedUsers.push(userAddress);

    saveProposals();
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
        const total = p.votes.for + p.votes.against;
        const forPercent = total === 0 ? 0 : Math.round((p.votes.for / total) * 100);
        const againstPercent = total === 0 ? 0 : Math.round((p.votes.against / total) * 100);

        const hasVoted = p.votedUsers && userAddress && p.votedUsers.includes(userAddress);

        return `
            <div class="proposal-card">
                <div class="proposal-header">
                    <span class="proposal-status active">Active</span>
                    <span style="color:var(--text-secondary); font-size:12px">#${p.id}</span>
                </div>
                <h3 class="proposal-title">${p.title}</h3>
                <p class="proposal-desc">${p.description}</p>
                
                <!-- Results -->
                <div class="result-row">
                    <div class="result-meta">
                        <span>For</span>
                        <span>${p.votes.for} (${forPercent}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${forPercent}%; background-color: var(--accent-color)"></div>
                    </div>
                </div>
                
                <div class="result-row">
                    <div class="result-meta">
                        <span>Against</span>
                        <span>${p.votes.against} (${againstPercent}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${againstPercent}%; background-color: var(--danger-color)"></div>
                    </div>
                </div>

                <!-- Actions -->
                ${!hasVoted ? `
                    <div class="vote-options">
                        <button class="vote-btn" onclick="vote('${p.id}', 'for')">Vote For</button>
                        <button class="vote-btn" onclick="vote('${p.id}', 'against')">Vote Against</button>
                    </div>
                ` : `
                    <div style="margin-top:15px; font-size:14px; color:var(--text-secondary); text-align:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px;">
                        You have voted.
                    </div>
                `}
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
    document.getElementById('create-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('create-modal').style.display = 'none';
    document.getElementById('p-title').value = '';
    document.getElementById('p-desc').value = '';
}

function handleSubmitProposal() {
    const title = document.getElementById('p-title').value;
    const desc = document.getElementById('p-desc').value;

    if (!title || !desc) {
        alert("Please fill in all fields");
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
