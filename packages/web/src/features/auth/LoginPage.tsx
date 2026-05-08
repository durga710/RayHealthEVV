import React from 'react';

export function LoginPage() {
  return (
    <div>
      <h1>Login</h1>
      <form>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" />
        <br />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" />
        <br />
        <button type="submit">Log in</button>
      </form>
    </div>
  );
}