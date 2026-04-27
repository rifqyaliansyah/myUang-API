const { Pool } = require('pg')
const env = require('./env')

const pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    database: env.db.name,
    user: env.db.user,
    password: env.db.password,
})

pool.on('error', (err) => {
    console.error('Unexpected DB error:', err)
    process.exit(-1)
})

module.exports = pool