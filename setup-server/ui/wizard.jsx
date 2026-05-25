import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIMEZONES = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo',
    'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
];
const FONTS = ['Inter', 'Geist', 'Poppins', 'Manrope', 'DM Sans'];
const STEP_LABELS = [
    'Project', 'Database', 'Auth', 'Roles', 'Fields', 'Theme', 'Review',
];

// ─── Initial State ────────────────────────────────────────────────────────────
const INIT = {
    // Step 1
    projectName: '', tagline: '', supportEmail: '', baseUrl: 'http://localhost:3000',
    timezone: 'UTC', logo: null,
    // Step 2
    mongoUri: '', dbName: '', dbTestPassed: false, upstashUrl: '', upstashToken: '',
    // Step 3
    providers: ['email'],
    loginIdentifier: 'email',
    requireEmailVerification: false,
    rememberMe: { enabled: false, days: 30 },
    passwordRules: { minLength: 8, requireNumber: false, requireSpecialChar: false },
    oauthCredentials: {
        google: { clientId: '', clientSecret: '' },
        github: { clientId: '', clientSecret: '' },
        discord: { clientId: '', clientSecret: '' },
    },
    // Step 4
    roles: [
        { id: 1, name: 'user', color: '#6366f1', isDefault: true },
        { id: 2, name: 'admin', color: '#ef4444', isDefault: false },
    ],
    adminAccount: { name: '', email: '', password: '' },
    // Step 5
    standardFields: {
        firstName: { enabled: true, required: true },
        lastName: { enabled: true, required: false },
        username: { enabled: false, required: false },
        phone: { enabled: false, required: false },
        dateOfBirth: { enabled: false, required: false },
        avatar: { enabled: false, required: false },
        company: { enabled: false, required: false },
    },
    customFields: [],
    // Step 6
    theme: { primaryColor: '#6366f1', accentColor: '#f59e0b', font: 'Inter', darkMode: 'toggle', borderRadius: 'rounded' },
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function Toggle({ checked, onChange }) {
    return (
        <label className="toggle">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span className="toggle-track" />
        </label>
    );
}
function FormGroup({ label, required, hint, error, children }) {
    return (
        <div className="form-group">
            {label && <label>{label}{required && <span className="req">*</span>}</label>}
            {children}
            {hint && <div className="field-hint">{hint}</div>}
            {error && <div className="error-msg">{error}</div>}
        </div>
    );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }) {
    return (
        <div className="progress-bar">
            {STEP_LABELS.map((label, i) => (
                <div key={i} className={`pb-step${i < step ? ' done' : ''}${i === step ? ' active' : ''}`}>
                    <div className="pb-dot">{i < step ? '✓' : i + 1}</div>
                    <div className="pb-label">{label}</div>
                </div>
            ))}
        </div>
    );
}

// ─── Step 1: Project Identity ─────────────────────────────────────────────────
function Step1({ data, set, errors }) {
    function handleLogo(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => set('logo', reader.result);
        reader.readAsDataURL(file);
    }
    return (
        <div>
            <div className="form-row">
                <FormGroup label="Project Name" required error={errors.projectName}>
                    <input type="text" value={data.projectName} onChange={e => set('projectName', e.target.value)} placeholder="Acme App" className={errors.projectName ? 'error' : ''} />
                </FormGroup>
                <FormGroup label="Tagline" hint="Short one-liner for your app">
                    <input type="text" value={data.tagline} onChange={e => set('tagline', e.target.value)} placeholder="The best app ever built" />
                </FormGroup>
            </div>
            <div className="form-row">
                <FormGroup label="Support Email" required error={errors.supportEmail}>
                    <input type="email" value={data.supportEmail} onChange={e => set('supportEmail', e.target.value)} placeholder="support@acme.com" className={errors.supportEmail ? 'error' : ''} />
                </FormGroup>
                <FormGroup label="Base URL" required error={errors.baseUrl}>
                    <input type="url" value={data.baseUrl} onChange={e => set('baseUrl', e.target.value)} placeholder="http://localhost:3000" className={errors.baseUrl ? 'error' : ''} />
                </FormGroup>
            </div>
            <div className="form-row">
                <FormGroup label="Timezone">
                    <select value={data.timezone} onChange={e => set('timezone', e.target.value)}>
                        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                </FormGroup>
                <FormGroup label="Logo" hint="PNG, JPG, or SVG — stored in public/">
                    <div className="file-upload-wrapper">
                        <input type="file" accept="image/*" id="logo-file-input" onChange={handleLogo} />
                        <label htmlFor="logo-file-input" className={`file-upload-label${data.logo ? ' has-file' : ''}`}>
                            {data.logo ? '✓ Logo loaded — click to change' : 'Click to upload logo'}
                        </label>
                    </div>
                </FormGroup>
            </div>
        </div>
    );
}


// ─── Step 2: Database ─────────────────────────────────────────────────────────
function Step2({ data, set, errors }) {
    const [testing, setTesting] = useState(false);
    const [feedback, setFeedback] = useState(null);

    async function testConnection() {
        setTesting(true);
        setFeedback({ status: 'testing', msg: 'Connecting…' });
        try {
            const r = await fetch('/api/test-db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uri: data.mongoUri }),
            });
            const json = await r.json();
            if (json.success) {
                setFeedback({ status: 'ok', msg: `✓ Connected · DB: ${json.dbName} · Latency: ${json.latency}ms` });
                set('dbTestPassed', true);
                if (!data.dbName) set('dbName', json.dbName);
            } else {
                setFeedback({ status: 'err', msg: `✗ ${json.error}` });
                set('dbTestPassed', false);
            }
        } catch (e) {
            setFeedback({ status: 'err', msg: `✗ Network error: ${e.message}` });
            set('dbTestPassed', false);
        } finally {
            setTesting(false);
        }
    }

    return (
        <div>
            <FormGroup label="MongoDB URI" required error={errors.mongoUri} hint="mongodb+srv://user:pass@cluster.mongodb.net/dbname">
                <input
                    value={data.mongoUri}
                    onChange={e => { set('mongoUri', e.target.value); set('dbTestPassed', false); setFeedback(null); }}
                    placeholder="mongodb+srv://..."
                    className={errors.mongoUri ? 'error' : ''}
                />
            </FormGroup>
            <button className="btn btn-outline" onClick={testConnection} disabled={testing || !data.mongoUri}>
                {testing ? '⏳ Testing…' : '🔌 Test Connection'}
            </button>
            {feedback && (
                <div className={`db-feedback ${feedback.status === 'ok' ? 'ok' : feedback.status === 'err' ? 'err' : ''}`}>
                    {feedback.msg}
                </div>
            )}
            {errors.dbTestPassed && <div className="error-msg" style={{ marginTop: '.5rem' }}>{errors.dbTestPassed}</div>}
            <hr className="divider" />
            <FormGroup label="Database Name" hint="Defaults to the name in your URI">
                <input value={data.dbName} onChange={e => set('dbName', e.target.value)} placeholder="my-app-db" />
            </FormGroup>

            <hr className="divider" />
            <label style={{ marginBottom: '.6rem', display: 'block' }}>Redis Rate Limiting (Production) - Optional</label>
            <FormGroup label="Upstash Redis URL" hint="e.g. https://eu2-evident-rhino-11223.upstash.io">
                <input value={data.upstashUrl} onChange={e => set('upstashUrl', e.target.value)} placeholder="https://..." />
            </FormGroup>
            <FormGroup label="Upstash Redis Token">
                <input type="password" value={data.upstashToken} onChange={e => set('upstashToken', e.target.value)} placeholder="Secret token" />
            </FormGroup>
        </div>
    );
}

// ─── Step 3: Authentication ────────────────────────────────────────────────────
function Step3({ data, set }) {
    const oauthProviders = ['google', 'github', 'discord'];
    function toggleProvider(name) {
        const current = data.providers;
        if (name === 'email') return; // always on
        if (current.includes(name)) set('providers', current.filter(p => p !== name));
        else set('providers', [...current, name]);
    }
    function setOAuth(provider, field, value) {
        set('oauthCredentials', { ...data.oauthCredentials, [provider]: { ...data.oauthCredentials[provider], [field]: value } });
    }
    function setRememberMe(field, value) {
        set('rememberMe', { ...data.rememberMe, [field]: value });
    }
    function setPwdRule(field, value) {
        set('passwordRules', { ...data.passwordRules, [field]: value });
    }

    return (
        <div>
            <div className="form-group">
                <label>Auth Providers</label>
                <div className="toggle-row">
                    <div className="toggle-label">Email / Password<small>Always enabled — primary auth method</small></div>
                    <Toggle checked={true} onChange={() => { }} />
                </div>
                {oauthProviders.map(p => (
                    <div key={p}>
                        <div className="toggle-row">
                            <div className="toggle-label" style={{ textTransform: 'capitalize' }}>{p} OAuth</div>
                            <Toggle checked={data.providers.includes(p)} onChange={() => toggleProvider(p)} />
                        </div>
                        {data.providers.includes(p) && (
                            <div className="form-row" style={{ marginBottom: '.75rem', marginLeft: '1rem' }}>
                                <FormGroup label={`${p} Client ID`}>
                                    <input value={data.oauthCredentials[p].clientId} onChange={e => setOAuth(p, 'clientId', e.target.value)} placeholder="Client ID" />
                                </FormGroup>
                                <FormGroup label={`${p} Client Secret`}>
                                    <input type="password" value={data.oauthCredentials[p].clientSecret} onChange={e => setOAuth(p, 'clientSecret', e.target.value)} placeholder="Client Secret" />
                                </FormGroup>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <hr className="divider" />
            <FormGroup label="Login Identifier">
                <select value={data.loginIdentifier} onChange={e => set('loginIdentifier', e.target.value)}>
                    <option value="email">Email only</option>
                    <option value="username">Username only</option>
                    <option value="either">Email or Username</option>
                </select>
            </FormGroup>

            <div className="toggle-row">
                <div className="toggle-label">Require Email Verification<small>Users must verify before logging in</small></div>
                <Toggle checked={data.requireEmailVerification} onChange={v => set('requireEmailVerification', v)} />
            </div>
            <div className="toggle-row">
                <div className="toggle-label">Remember Me<small>Allow users to stay logged in</small></div>
                <Toggle checked={data.rememberMe.enabled} onChange={v => setRememberMe('enabled', v)} />
            </div>
            {data.rememberMe.enabled && (
                <FormGroup label="Remember Me Duration (days)" hint="Max days a session persists when remember me is checked">
                    <input type="number" value={data.rememberMe.days} min={1} max={365} onChange={e => setRememberMe('days', parseInt(e.target.value) || 30)} />
                </FormGroup>
            )}

            <hr className="divider" />
            <label style={{ marginBottom: '.75rem', display: 'block' }}>Password Rules</label>
            <FormGroup label="Minimum Length">
                <input type="number" value={data.passwordRules.minLength} min={4} max={64} onChange={e => setPwdRule('minLength', parseInt(e.target.value) || 8)} />
            </FormGroup>
            <div className="toggle-row">
                <div className="toggle-label">Require Number</div>
                <Toggle checked={data.passwordRules.requireNumber} onChange={v => setPwdRule('requireNumber', v)} />
            </div>
            <div className="toggle-row">
                <div className="toggle-label">Require Special Character</div>
                <Toggle checked={data.passwordRules.requireSpecialChar} onChange={v => setPwdRule('requireSpecialChar', v)} />
            </div>
        </div>
    );
}

// ─── Step 4: User Roles ────────────────────────────────────────────────────────
function Step4({ data, set, errors }) {
    const nextId = useRef(10);
    function addRole() {
        set('roles', [...data.roles, { id: nextId.current++, name: '', color: '#94a3b8', isDefault: false }]);
    }
    function removeRole(id) {
        if (data.roles.length <= 1) return;
        const updated = data.roles.filter(r => r.id !== id);
        if (!updated.some(r => r.isDefault)) updated[0].isDefault = true;
        set('roles', updated);
    }
    function updateRole(id, field, value) {
        set('roles', data.roles.map(r => {
            if (r.id !== id) return field === 'isDefault' && value ? { ...r, isDefault: false } : r;
            return { ...r, [field]: value };
        }));
    }
    function setAdmin(field, value) {
        set('adminAccount', { ...data.adminAccount, [field]: value });
    }

    return (
        <div>
            <label style={{ marginBottom: '.6rem', display: 'block' }}>Roles</label>
            <div className="role-list">
                {data.roles.map(role => (
                    <div key={role.id} className="role-item">
                        <div className="role-dot" style={{ background: role.color }} />
                        <input
                            type="text"
                            value={role.name}
                            onChange={e => updateRole(role.id, 'name', e.target.value)}
                            placeholder="Role name"
                        />
                        <input
                            type="color"
                            value={role.color}
                            onChange={e => updateRole(role.id, 'color', e.target.value)}
                        />
                        {role.isDefault
                            ? <span className="role-default-badge">Default</span>
                            : <button className="btn btn-sm btn-outline" onClick={() => updateRole(role.id, 'isDefault', true)}>Set Default</button>
                        }
                        {data.roles.length > 1 && (
                            <button className="btn btn-sm btn-danger" onClick={() => removeRole(role.id)}>✕</button>
                        )}
                    </div>
                ))}
            </div>
            {errors.roles && <div className="error-msg">{errors.roles}</div>}
            <button className="btn btn-outline btn-sm" onClick={addRole}>+ Add Role</button>

            <hr className="divider" />
            <label style={{ marginBottom: '.75rem', display: 'block' }}>First Admin Account</label>
            <div className="form-row">
                <FormGroup label="Full Name" required error={errors.adminName}>
                    <input value={data.adminAccount.name} onChange={e => setAdmin('name', e.target.value)} placeholder="Jane Smith" className={errors.adminName ? 'error' : ''} />
                </FormGroup>
                <FormGroup label="Email" required error={errors.adminEmail}>
                    <input type="email" value={data.adminAccount.email} onChange={e => setAdmin('email', e.target.value)} placeholder="admin@acme.com" className={errors.adminEmail ? 'error' : ''} />
                </FormGroup>
            </div>
            <FormGroup label="Password" required error={errors.adminPassword} hint="Min 8 characters — you can change this after setup">
                <input type="password" value={data.adminAccount.password} onChange={e => setAdmin('password', e.target.value)} placeholder="Strong password" className={errors.adminPassword ? 'error' : ''} />
            </FormGroup>
        </div>
    );
}

// ─── Step 5: Registration Fields ──────────────────────────────────────────────
const STD_LABELS = {
    firstName: 'First Name', lastName: 'Last Name', username: 'Username',
    phone: 'Phone', dateOfBirth: 'Date of Birth', avatar: 'Avatar / Profile Picture', company: 'Company',
};

function Step5({ data, set }) {
    function toggleStd(key, field, value) {
        const updated = { ...data.standardFields, [key]: { ...data.standardFields[key], [field]: value } };
        if (field === 'enabled' && !value) updated[key].required = false;
        set('standardFields', updated);
    }
    function addCustom() {
        set('customFields', [...data.customFields, { id: Date.now(), name: '', label: '', type: 'text', required: false, pii: false, options: [] }]);
    }
    function updateCustom(id, field, value) {
        set('customFields', data.customFields.map(f => f.id === id ? { ...f, [field]: value } : f));
    }
    function removeCustom(id) {
        set('customFields', data.customFields.filter(f => f.id !== id));
    }

    return (
        <div>
            <label style={{ marginBottom: '.6rem', display: 'block' }}>Standard Fields</label>
            <div className="fields-grid">
                {Object.entries(data.standardFields).map(([key, val]) => (
                    <div key={key} className={`field-row${val.enabled ? ' enabled' : ''}`}>
                        <span className="field-name">{STD_LABELS[key]}</span>
                        <span className="field-req-label">Enabled</span>
                        <Toggle checked={val.enabled} onChange={v => toggleStd(key, 'enabled', v)} />
                        {val.enabled && <>
                            <span className="field-req-label">Required</span>
                            <Toggle checked={val.required} onChange={v => toggleStd(key, 'required', v)} />
                        </>}
                    </div>
                ))}
            </div>

            <hr className="divider" />
            <label style={{ marginBottom: '.6rem', display: 'block' }}>Custom Fields</label>
            {data.customFields.map(f => (
                <div key={f.id} className="custom-field-item">
                    <div className="custom-field-row">
                        <FormGroup label="Field Name (camelCase)">
                            <input value={f.name} onChange={e => updateCustom(f.id, 'name', e.target.value)} placeholder="phoneNumber" />
                        </FormGroup>
                        <FormGroup label="Label">
                            <input value={f.label} onChange={e => updateCustom(f.id, 'label', e.target.value)} placeholder="Phone Number" />
                        </FormGroup>
                        <FormGroup label="Type">
                            <select value={f.type} onChange={e => updateCustom(f.id, 'type', e.target.value)}>
                                {['text', 'number', 'date', 'select', 'checkbox'].map(t => <option key={t}>{t}</option>)}
                            </select>
                        </FormGroup>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', paddingTop: '1.5rem' }}>
                            <label style={{ margin: 0, fontSize: '.8rem' }}>Req</label>
                            <Toggle checked={f.required} onChange={v => updateCustom(f.id, 'required', v)} />
                            <label style={{ margin: 0, fontSize: '.8rem' }}>PII</label>
                            <Toggle checked={f.pii} onChange={v => updateCustom(f.id, 'pii', v)} />
                            <button className="btn btn-danger btn-sm" onClick={() => removeCustom(f.id)}>✕</button>
                        </div>
                    </div>
                    {f.type === 'select' && (
                        <FormGroup label="Options (comma-separated)" hint="e.g. Option A, Option B, Option C">
                            <input
                                value={f.options.join(', ')}
                                onChange={e => updateCustom(f.id, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                placeholder="Option A, Option B"
                            />
                        </FormGroup>
                    )}
                </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={addCustom}>+ Add Custom Field</button>
        </div>
    );
}

// ─── Step 6: Theme ─────────────────────────────────────────────────────────────
function Step6({ data, set }) {
    function setTheme(field, value) { set('theme', { ...data.theme, [field]: value }); }
    const t = data.theme;
    const radii = { none: '0px', rounded: '6px', pill: '99px', sharp: '2px' };

    return (
        <div className="theme-layout">
            <div>
                <div className="form-row">
                    <FormGroup label="Primary Color">
                        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                            <input type="color" value={t.primaryColor} onChange={e => setTheme('primaryColor', e.target.value)} style={{ width: 40, height: 38, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                            <input value={t.primaryColor} onChange={e => setTheme('primaryColor', e.target.value)} placeholder="#6366f1" />
                        </div>
                    </FormGroup>
                    <FormGroup label="Accent Color">
                        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                            <input type="color" value={t.accentColor} onChange={e => setTheme('accentColor', e.target.value)} style={{ width: 40, height: 38, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                            <input value={t.accentColor} onChange={e => setTheme('accentColor', e.target.value)} placeholder="#f59e0b" />
                        </div>
                    </FormGroup>
                </div>
                <FormGroup label="Font">
                    <select value={t.font} onChange={e => setTheme('font', e.target.value)}>
                        {FONTS.map(f => <option key={f}>{f}</option>)}
                    </select>
                </FormGroup>
                <FormGroup label="Dark Mode">
                    <select value={t.darkMode} onChange={e => setTheme('darkMode', e.target.value)}>
                        <option value="toggle">User can toggle</option>
                        <option value="light">Always light</option>
                        <option value="dark">Always dark</option>
                    </select>
                </FormGroup>
                <FormGroup label="Border Radius">
                    <div className="radius-options">
                        {Object.keys(radii).map(r => (
                            <button key={r} className={`radius-opt${t.borderRadius === r ? ' active' : ''}`} onClick={() => setTheme('borderRadius', r)}>
                                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderRadius: radii[r], marginRight: 4, verticalAlign: 'middle' }} />
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                            </button>
                        ))}
                    </div>
                </FormGroup>
            </div>

            {/* Live preview */}
            <div className="preview-panel">
                <h4>Live Preview</h4>
                <div className="preview-nav" style={{ background: t.primaryColor }}>
                    <span>●</span> {data.projectName || 'My App'}
                </div>
                <div className="preview-card" style={{ borderRadius: radii[t.borderRadius] }}>
                    <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginBottom: '.5rem', fontFamily: t.font + ',sans-serif' }}>Sign in to your account</div>
                    <input className="preview-input" style={{ borderRadius: radii[t.borderRadius], fontFamily: t.font + ',sans-serif' }} defaultValue="user@example.com" readOnly />
                    <button className="preview-btn" style={{ background: t.primaryColor, borderRadius: radii[t.borderRadius], fontFamily: t.font + ',sans-serif', width: '100%' }}>
                        Login
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    <span style={{ background: t.primaryColor + '33', color: t.primaryColor, padding: '.2rem .6rem', borderRadius: radii[t.borderRadius] || '6px', fontSize: '.75rem', fontWeight: 600 }}>Primary</span>
                    <span style={{ background: t.accentColor + '33', color: t.accentColor, padding: '.2rem .6rem', borderRadius: radii[t.borderRadius] || '6px', fontSize: '.75rem', fontWeight: 600 }}>Accent</span>
                    <span style={{ background: 'var(--surface2)', color: 'var(--text)', padding: '.2rem .6rem', borderRadius: radii[t.borderRadius] || '6px', fontSize: '.75rem' }}>Default</span>
                </div>
            </div>
        </div>
    );
}

// ─── Step 7: Review & Initialise ──────────────────────────────────────────────
function Step7({ data, goTo }) {
    const [log, setLog] = useState([]);
    const [running, setRunning] = useState(false);
    const [finished, setFinished] = useState(false);
    const logRef = useRef(null);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [log]);

    async function initialise() {
        setRunning(true);
        setLog([]);
        try {
            const response = await fetch('/api/initialise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const ev = JSON.parse(line.slice(6));
                            if (ev.done) {
                                setLog(l => [...l, { msg: ev.msg || '🎉 Done! Redirecting…', ok: true }]);
                                setFinished(true);
                                setTimeout(() => { window.location.href = ev.redirectUrl || 'http://localhost:3000/login'; }, 2000);
                            } else {
                                setLog(l => [...l, { msg: ev.msg, ok: ev.ok !== false, fatal: ev.fatal }]);
                            }
                        } catch { }
                    }
                }
            }
        } catch (e) {
            setLog(l => [...l, { msg: `Network error: ${e.message}`, ok: false, fatal: true }]);
        }
        setRunning(false);
    }

    const enabledStdFields = Object.entries(data.standardFields).filter(([, v]) => v.enabled).map(([k]) => STD_LABELS[k]);

    return (
        <div>
            <div className="review-section">
                <h4>Project Identity <button className="btn btn-sm btn-outline" onClick={() => goTo(0)}>Edit</button></h4>
                <div className="review-grid">
                    <div className="review-kv"><span>Name: </span>{data.projectName}</div>
                    <div className="review-kv"><span>Email: </span>{data.supportEmail}</div>
                    <div className="review-kv"><span>Base URL: </span>{data.baseUrl}</div>
                    <div className="review-kv"><span>Timezone: </span>{data.timezone}</div>
                </div>
            </div>
            <div className="review-section">
                <h4>Database <button className="btn btn-sm btn-outline" onClick={() => goTo(1)}>Edit</button></h4>
                <div className="review-kv"><span>URI: </span>{'****' + data.mongoUri.slice(-20)}</div>
                {data.upstashUrl && <div className="review-kv"><span>Upstash: </span>{data.upstashUrl}</div>}
            </div>
            <div className="review-section">
                <h4>Auth <button className="btn btn-sm btn-outline" onClick={() => goTo(2)}>Edit</button></h4>
                <div className="review-grid">
                    <div className="review-kv"><span>Providers: </span>{data.providers.join(', ')}</div>
                    <div className="review-kv"><span>Login by: </span>{data.loginIdentifier}</div>
                    <div className="review-kv"><span>Min password: </span>{data.passwordRules.minLength} chars</div>
                    <div className="review-kv"><span>Email verify: </span>{String(data.requireEmailVerification)}</div>
                </div>
            </div>
            <div className="review-section">
                <h4>Roles <button className="btn btn-sm btn-outline" onClick={() => goTo(3)}>Edit</button></h4>
                <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                    {data.roles.map(r => (
                        <span key={r.id} style={{ background: r.color + '22', color: r.color, border: `1px solid ${r.color}55`, padding: '.2rem .65rem', borderRadius: '99px', fontSize: '.82rem' }}>
                            {r.name}{r.isDefault ? ' (default)' : ''}
                        </span>
                    ))}
                </div>
            </div>
            <div className="review-section">
                <h4>Registration Fields <button className="btn btn-sm btn-outline" onClick={() => goTo(4)}>Edit</button></h4>
                <div className="review-kv"><span>Enabled: </span>{enabledStdFields.join(', ') || 'None'}</div>
                {data.customFields.length > 0 && <div className="review-kv"><span>Custom: </span>{data.customFields.map(f => f.label || f.name).join(', ')}</div>}
            </div>
            <div className="review-section">
                <h4>Theme <button className="btn btn-sm btn-outline" onClick={() => goTo(5)}>Edit</button></h4>
                <div className="review-grid">
                    <div className="review-kv"><span>Font: </span>{data.theme.font}</div>
                    <div className="review-kv"><span>Dark mode: </span>{data.theme.darkMode}</div>
                    <div className="review-kv" style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                        <span>Primary: </span><span style={{ display: 'inline-block', width: 14, height: 14, background: data.theme.primaryColor, borderRadius: 3 }} />{data.theme.primaryColor}
                    </div>
                </div>
            </div>

            <hr className="divider" />
            <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Clicking Initialise will: write <code>project.config.ts</code>, generate <code>.env.local</code> with RS256 keys, seed MongoDB (roles, admin user, system config), and boot Next.js.
            </p>

            {!running && !finished && (
                <button className="btn btn-primary" onClick={initialise}>🚀 Initialise Project</button>
            )}

            {(running || log.length > 0) && (
                <div className="log-box" ref={logRef}>
                    {log.map((l, i) => (
                        <div key={i} className={`log-line${l.fatal ? ' err' : l.ok ? ' ok' : ' warn'}`}>
                            {l.fatal ? '✗' : l.ok ? '▶' : '⚠'} {l.msg}
                        </div>
                    ))}
                    {running && <div className="log-line ok">⏳ Working…</div>}
                </div>
            )}

            {finished && (
                <div className="db-feedback ok" style={{ marginTop: '1rem' }}>
                    ✓ Setup complete! Redirecting to your app…
                </div>
            )}
        </div>
    );
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(step, data) {
    const errs = {};
    if (step === 0) {
        if (!data.projectName.trim()) errs.projectName = 'Project name is required';
        if (!data.supportEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.supportEmail)) errs.supportEmail = 'Valid email required';
        if (!data.baseUrl.trim() || !/^https?:\/\//.test(data.baseUrl)) errs.baseUrl = 'Valid URL required (http:// or https://)';
    }
    if (step === 1) {
        if (!data.mongoUri.trim()) errs.mongoUri = 'MongoDB URI is required';
        if (!data.dbTestPassed) errs.dbTestPassed = 'Database connection must pass before continuing';
    }
    if (step === 3) {
        if (data.roles.some(r => !r.name.trim())) errs.roles = 'All roles must have a name';
        if (!data.roles.some(r => r.isDefault)) errs.roles = 'One role must be set as default';
        if (!data.adminAccount.name.trim()) errs.adminName = 'Admin name is required';
        if (!data.adminAccount.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminAccount.email)) errs.adminEmail = 'Valid admin email required';
        if (data.adminAccount.password.length < 8) errs.adminPassword = 'Password must be at least 8 characters';
    }
    return errs;
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
    const [step, setStep] = useState(0);
    const [data, setData] = useState(INIT);
    const [errors, setErrors] = useState({});

    function set(key, value) {
        setData(d => ({ ...d, [key]: value }));
    }

    function handleNext() {
        const errs = validate(step, data);
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setErrors({});
        if (step < 6) setStep(s => s + 1);
    }
    function handleBack() { setErrors({}); setStep(s => s - 1); }
    function goTo(s) { setErrors({}); setStep(s); }

    const steps = [Step1, Step2, Step3, Step4, Step5, Step6, Step7];
    const StepComp = steps[step];

    return (
        <div>
            <div className="wizard-header">
                <h1>Project Setup Wizard</h1>
                <p>Configure your boilerplate in about 5 minutes</p>
            </div>
            <ProgressBar step={step} />
            <div className="card">
                <div className="card-title">{['Project Identity', 'Database', 'Authentication', 'User Roles', 'Registration Fields', 'Theme', 'Review & Initialise'][step]}</div>
                <StepComp data={data} set={set} errors={errors} goTo={goTo} />
            </div>
            {step < 6 && (
                <div className="wizard-nav">
                    <button className="btn btn-outline" onClick={handleBack} disabled={step === 0}>← Back</button>
                    <button className="btn btn-primary" onClick={handleNext}>
                        {step === 5 ? 'Review →' : 'Next →'}
                    </button>
                </div>
            )}
            {step === 6 && (
                <div className="wizard-nav">
                    <button className="btn btn-outline" onClick={handleBack}>← Back</button>
                    <span />
                </div>
            )}
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App />);
