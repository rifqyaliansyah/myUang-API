require('./src/config/env')
const express = require('express')
const cors = require('cors')
const env = require('./src/config/env')
const authRoutes = require('./src/routes/auth.routes')
const walletRoutes = require('./src/routes/wallet.routes')
const pocketRoutes = require('./src/routes/pocket.routes')

const app = express()

app.use(cors({
    origin: [
        'http://localhost:8100',
        'https://bgdr3s45-8100.asse.devtunnels.ms',
        'https://my-uang.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/wallets', walletRoutes)
app.use('/api/pockets', pocketRoutes)

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' })
})

// Global error handler
app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ success: false, message: 'Internal server error' })
})

app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`)
})