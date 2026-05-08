import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login();
    navigate('/admin/agency');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-bg)'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', margin: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            RayHealth <span className="evv-badge" style={{ backgroundColor: 'var(--color-accent)', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', letterSpacing: '2px', fontWeight: 800 }}>EVV</span>
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', letterSpacing: '1px' }}>Electronic Visit Verification</p>
        </div>
        
        <form onSubmit={handleLogin}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="admin@rayhealth-evv.example" required />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="••••••••" required />
          </div>
          
          <button type="submit" style={{ width: '100%', marginTop: '2rem' }}>Log In to Admin</button>
        </form>
      </div>
    </div>
  );
}