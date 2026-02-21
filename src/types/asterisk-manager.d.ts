declare module 'asterisk-manager' {
  import { EventEmitter } from 'events';

  interface AmiOptions {
    reconnect?: boolean;
    reconnect_after?: number;
    events?: boolean | string;
  }

  class AsteriskManager extends EventEmitter {
    constructor(port: number, host: string, username: string, password: string, events?: boolean);
    keepConnected(): void;
    disconnect(): void;
    isConnected(): boolean;
    action(action: Record<string, string>, callback?: (err: Error | null, res: Record<string, string>) => void): void;
  }

  export = AsteriskManager;
}
