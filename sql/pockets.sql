CREATE TABLE pockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE
    SET
        NULL,
        emoji VARCHAR(10) DEFAULT '😊',
        name VARCHAR(100) NOT NULL,
        budget_limit NUMERIC(15, 2) DEFAULT 0,
        used NUMERIC(15, 2) DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
);