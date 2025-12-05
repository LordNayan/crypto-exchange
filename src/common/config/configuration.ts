export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  environment: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    name: process.env.POSTGRES_DB,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
  security: {
    jwtSecret: process.env.JWT_SECRET,
  },
  bitcoin: {
    rpcHost: process.env.BITCOIN_RPC_HOST,
    rpcPort: parseInt(process.env.BITCOIN_RPC_PORT, 10) || 18332,
    rpcUser: process.env.BITCOIN_RPC_USER,
    rpcPassword: process.env.BITCOIN_RPC_PASSWORD,
  },
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    privateKey: process.env.ETHEREUM_PRIVATE_KEY,
  },
});

