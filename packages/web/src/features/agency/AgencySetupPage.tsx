import React from 'react';

export function AgencySetupPage() {
  return (
    <div>
      <h1>Agency Setup</h1>
      <form>
        <label htmlFor="name">Agency Name</label>
        <input id="name" />
        <br />
        <button type="submit">Save</button>
      </form>
    </div>
  );
}