/**
 * SFTP clearinghouse transport, the industry-standard batch drop.
 *
 * The real ssh2-sftp-client is loaded lazily inside the default factory so
 * nothing static-imports a node-native dependency (tests inject a fake, and
 * request paths that never touch SFTP pay no cold-start cost). Remote files
 * are never renamed or deleted: the local remittance ledger (sha256 dedupe)
 * is the idempotence mechanism, which stays safe across clearinghouses with
 * different retention rules.
 *
 * Error hygiene: remote error text can contain paths and server banners, so
 * messages are classified (auth vs network) and rephrased, never passed
 * through. Credentials never appear in messages.
 */
import { createHash } from 'crypto';
import type {
  ClearinghouseTransport,
  TransportFetchResult,
  TransportSubmitResult,
  TransportTestResult,
} from './clearinghouse-transport.js';

/** The narrow surface we use, injectable for tests. */
export interface SftpLike {
  connect(options: {
    host: string;
    port: number;
    username: string;
    password: string;
    readyTimeout?: number;
  }): Promise<unknown>;
  put(input: Buffer, remotePath: string): Promise<unknown>;
  list(remoteDir: string): Promise<Array<{ name: string; type: string }>>;
  get(remotePath: string): Promise<Buffer | string>;
  end(): Promise<unknown>;
}

export type SftpFactory = () => Promise<SftpLike>;

const defaultSftpFactory: SftpFactory = async () => {
  const mod = (await import('ssh2-sftp-client')) as unknown as { default: new () => SftpLike };
  return new mod.default();
};

export interface SftpTransportInput {
  host: string;
  username: string;
  password: string;
  settings: Record<string, unknown>;
}

const REMITTANCE_FILE = /\.(835|era|edi|txt)$/i;

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Regex-free trailing-slash strip (config strings are admin input). */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
}

function settingString(settings: Record<string, unknown>, key: string, fallback: string): string {
  const value = settings[key];
  return typeof value === 'string' && value.trim() ? stripTrailingSlashes(value.trim()) : fallback;
}

function settingPort(settings: Record<string, unknown>): number {
  const value = Number(settings.port);
  return Number.isInteger(value) && value > 0 && value <= 65_535 ? value : 22;
}

function classify(error: unknown, phase: string): { kind: 'error'; message: string; retryable: boolean } {
  const text = error instanceof Error ? error.message : '';
  if (/auth|permission|denied/i.test(text)) {
    return { kind: 'error', message: 'SFTP authentication failed', retryable: false };
  }
  return { kind: 'error', message: `SFTP ${phase} failed`, retryable: true };
}

/** UTC timestamp like 20260708T031500, filesystem safe. */
function fileStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
}

export function createSftpClearinghouseTransport(
  input: SftpTransportInput,
  factory: SftpFactory = defaultSftpFactory,
): ClearinghouseTransport {
  const port = settingPort(input.settings);
  const uploadDir = settingString(input.settings, 'uploadDir', '/inbound');
  const remittanceDir = settingString(input.settings, 'remittanceDir', '/outbound');

  async function withClient<T>(
    phase: string,
    run: (client: SftpLike) => Promise<T>,
  ): Promise<T | { kind: 'error'; message: string; retryable: boolean }> {
    let client: SftpLike | null = null;
    try {
      client = await factory();
      await client.connect({
        host: input.host,
        port,
        username: input.username,
        password: input.password,
        readyTimeout: 8000,
      });
      return await run(client);
    } catch (error) {
      return classify(error, phase);
    } finally {
      if (client) {
        try {
          await client.end();
        } catch {
          // Closing failures are irrelevant once the operation finished.
        }
      }
    }
  }

  return {
    name: 'sftp',

    async submit(edi837, meta): Promise<TransportSubmitResult> {
      const remotePath = `${uploadDir}/claim-${meta.controlNumber}-${fileStamp()}.837`;
      const result = await withClient('upload', async (client) => {
        await client.put(Buffer.from(edi837, 'utf8'), remotePath);
        return { kind: 'ok' as const, reference: remotePath };
      });
      return result;
    },

    async fetchRemittances({ maxFiles }): Promise<TransportFetchResult> {
      const result = await withClient('download', async (client) => {
        const entries = await client.list(remittanceDir);
        const names = entries
          .filter((e) => e.type === '-' && REMITTANCE_FILE.test(e.name))
          .map((e) => e.name)
          .sort()
          .slice(0, maxFiles);
        const files = [];
        for (const name of names) {
          const raw = await client.get(`${remittanceDir}/${name}`);
          const content = typeof raw === 'string' ? raw : raw.toString('utf8');
          files.push({ name, content, sha256: sha256Hex(content) });
        }
        return { kind: 'ok' as const, files };
      });
      return result;
    },

    async testConnection(): Promise<TransportTestResult> {
      const result = await withClient('connection test', async (client) => {
        await client.list(remittanceDir);
        return {
          kind: 'ok' as const,
          detail: `Connected to ${input.host}:${port} and listed ${remittanceDir}`,
        };
      });
      return result;
    },
  };
}
