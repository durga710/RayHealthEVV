import apiClient, { setMobileAccessToken } from '../api-client';

describe('api-client', () => {
  it('has a baseURL configured', () => {
    expect(apiClient.defaults.baseURL).toBeDefined();
  });

  it('sends Content-Type application/json by default', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('attaches Authorization header after setMobileAccessToken', async () => {
    setMobileAccessToken('test-jwt-token');

    // Intercept the request to verify the header
    const config = await apiClient.interceptors.request.handlers[0].fulfilled!({
      headers: {} as any,
    } as any);

    expect(config.headers.Authorization).toBe('Bearer test-jwt-token');

    // Clean up
    setMobileAccessToken(null);
  });

  it('does not attach Authorization header when token is null', async () => {
    setMobileAccessToken(null);

    const config = await apiClient.interceptors.request.handlers[0].fulfilled!({
      headers: {} as any,
    } as any);

    expect(config.headers.Authorization).toBeUndefined();
  });
});
