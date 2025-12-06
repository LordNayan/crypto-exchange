# Crypto Exchange Backend MVP

A cryptocurrency exchange backend built with NestJS, TypeScript, and PostgreSQL. This system provides a robust infrastructure for monitoring blockchain deposits, managing user wallets, and handling real-time updates.

## 🚀 Features

- **Multi-Chain Support**:
  - **Bitcoin**: Polling-based deposit monitoring (every 30s) via Bitcoin Core RPC.
  - **Ethereum**: Real-time event listening via WebSocket (Alchemy/Infura/Node).
- **Security & Reliability**:
  - **HMAC Authentication**: Bitfinex-style API key signing for secure requests.
  - **Idempotency**: Redis-based locking to prevent double-spending/crediting.
  - **Reorg Handling**: Automatic detection and handling of blockchain reorganizations.
  - **Confirmation Tracking**: Configurable confirmation thresholds (6 for BTC, 12 for ETH).
- **Real-Time Updates**:
  - **WebSockets**: Push notifications for deposit status changes (pending -> confirmed).
  - **Redis Pub/Sub**: Internal event bus for microservices communication.
- **Data Persistence**:
  - **PostgreSQL**: Relational storage for users, transactions, and addresses.
  - **TypeORM**: ORM for type-safe database interactions.
  - **Redis**: High-performance caching and distributed locking.

## 🏗 Architecture

### Core Components

1.  **DepositService** (`src/wallet/deposit.service.ts`)
    *   Central logic for processing deposits.
    *   Manages state transitions (Pending -> Confirmed).
    *   Updates user balances atomically.
    *   Emits WebSocket events to connected clients.

2.  **BitcoinPollerService** (`src/wallet/bitcoin-poller.service.ts`)
    *   Polls Bitcoin Core for new blocks.
    *   Iterates over transactions to find deposits to managed addresses.
    *   Handles RPC type safety and error recovery.

3.  **EthereumListenerService** (`src/wallet/ethereum-listener.service.ts`)
    *   Subscribes to Ethereum block headers and logs.
    *   Filters events for exchange-owned addresses.

4.  **ConfirmationMonitorService** (`src/wallet/confirmation-monitor.service.ts`)
    *   Background cron job that checks pending transactions.
    *   Updates confirmation counts until the threshold is reached.

5.  **EventsGateway** (`src/events/events.gateway.ts`)
    *   WebSocket gateway for client connections.
    *   Handles authentication and room management.

### Data Flow

**Bitcoin Deposit:**
1.  `BitcoinPollerService` detects a new transaction in a block.
2.  Calls `DepositService.handleDeposit()` with 0 or 1 confirmation.
3.  `DepositService` saves transaction as `pending` and emits `deposit_pending` event.
4.  `ConfirmationMonitorService` checks periodically.
5.  Once 6 confirmations are reached, status updates to `confirmed`, balance is credited, and `deposit_confirmed` event is emitted.

## 🛠 Installation & Setup

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose

### 1. Start Infrastructure
Run PostgreSQL and Redis containers:
```bash
docker-compose up -d postgres redis
```

### 2. Install Dependencies
```bash
yarn
```

### 3. Configuration
Create a `.env` file (or rely on defaults for local dev):
```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=crypto_exchange

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Blockchain
BITCOIN_RPC_HOST=localhost
BITCOIN_RPC_PORT=18332
ETHEREUM_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

### 4. Run the Application
```bash
# Development mode
yarn start:dev
```

## 🧪 Testing

### End-to-End Flow Test
We have a comprehensive script that simulates a client:
1.  Authenticates via HMAC.
2.  Generates deposit addresses.
3.  Connects to WebSocket.
4.  Waits for events.

```bash
node scripts/test-flow.js
```

### Simulate a Deposit
To test the flow without real coins, use the simulation endpoint while `test-flow.js` is running:

```bash
# Syntax: node scripts/simulate-deposit.js <CURRENCY> <ADDRESS>
node scripts/simulate-deposit.js BTC <YOUR_GENERATED_ADDRESS>
```

### Unit Tests
```bash
yarn test
```

## 📚 API Documentation

### Wallet Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/wallet/address` | Generate a new deposit address for a user. |
| `GET` | `/wallet/addresses` | List all addresses for a user. |
| `GET` | `/wallet/balance` | Get current balance for a user. |
| `GET` | `/wallet/transactions` | Get transaction history. |

### WebSocket Events

*   `deposit_pending`: Emitted when a transaction is first seen.
*   `deposit_confirmed`: Emitted when confirmation threshold is met.

## 📂 Project Structure

```
crypto-exchange/
├── docker/             # Docker configuration
├── scripts/            # Utility and test scripts
├── src/
│   ├── auth/           # Authentication (HMAC, Guards)
│   ├── bitcoin/        # Bitcoin Core integration
│   ├── ethereum/       # Ethereum (Ethers.js) integration
│   ├── events/         # WebSocket Gateway
│   ├── users/          # User management
│   ├── wallet/         # Wallet, Deposits, and Monitoring logic
│   ├── app.module.ts   # Root module
│   └── main.ts         # Entry point
├── test/               # E2E tests
└── docker-compose.yml  # Infrastructure setup
```

## License

UNLICENSED
