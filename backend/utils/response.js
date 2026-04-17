const ok = (res, data) => res.json({ success: true, data });
const err = (res, msg, code = 500) => res.status(code).json({ success: false, message: msg });

module.exports = { ok, err };