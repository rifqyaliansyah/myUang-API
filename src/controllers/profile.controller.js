const multer = require('multer')
const pool = require('../config/database')
const supabase = require('../config/supabase')
const { success, error } = require('../utils/response.util')

const BUCKET = process.env.SUPABASE_BUCKET || 'avatars'

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Only JPEG, PNG, and WEBP images are allowed'))
        }
        cb(null, true)
    },
})

const uploadAvatar = async (file, userId) => {
    const ext = file.originalname.split('.').pop()
    const path = `${userId}.${ext}`

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        })

    if (uploadError) throw { statusCode: 500, message: 'Failed to upload avatar' }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
}

const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, avatar_url, quotes FROM users WHERE id = $1',
            [req.user.userId]
        )
        if (result.rows.length === 0) return error(res, 'User not found', 404)
        return success(res, result.rows[0], 'Profile fetched')
    } catch (err) {
        return error(res, err.message, 500)
    }
}

const updateProfile = async (req, res) => {
    try {
        const { name, quotes } = req.body
        let avatarUrl = null

        if (req.file) {
            avatarUrl = await uploadAvatar(req.file, req.user.userId)
        }

        const existing = await pool.query(
            'SELECT avatar_url FROM users WHERE id = $1',
            [req.user.userId]
        )
        const finalAvatarUrl = avatarUrl ?? existing.rows[0]?.avatar_url ?? null

        const result = await pool.query(
            `UPDATE users SET name = $1, quotes = $2, avatar_url = $3, updated_at = NOW()
             WHERE id = $4 RETURNING id, name, email, avatar_url, quotes`,
            [name, quotes || null, finalAvatarUrl, req.user.userId]
        )

        return success(res, result.rows[0], 'Profile updated')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

module.exports = { getProfile, updateProfile, upload }