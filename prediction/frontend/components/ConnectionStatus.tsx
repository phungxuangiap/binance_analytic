import type { ConnectionStatus as Status } from '../types/market';

type ConnectionStatusProps = {
  status: Status;
};

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <div className={`connectionStatus ${status}`}>
      <span className="statusDot" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
}
