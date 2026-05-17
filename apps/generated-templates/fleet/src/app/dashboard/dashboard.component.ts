/**
 * @file Fleet Dashboard — IoT device fleet monitoring view.
 *
 * KPI cards, filterable device table with status badges and signal-strength
 * bars, and a placeholder map area. Deterministic constant-driven data.
 */
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type DeviceStatus = 'online' | 'offline' | 'alert';
type StatusFilter = 'all' | DeviceStatus;

interface Device {
  readonly id: string;
  readonly name: string;
  readonly status: DeviceStatus;
  readonly lastSeen: string;
  readonly firmware: string;
  /** Signal strength in [0..5]. */
  readonly signal: number;
}

const DEVICES: readonly Device[] = [
  { id: 'D-0001', name: 'Gateway North', status: 'online', lastSeen: '2026-05-11 19:14', firmware: '2.4.1', signal: 5 },
  { id: 'D-0002', name: 'Sensor Hub A', status: 'online', lastSeen: '2026-05-11 19:13', firmware: '2.4.1', signal: 4 },
  { id: 'D-0003', name: 'Cold-Chain 12', status: 'alert', lastSeen: '2026-05-11 19:12', firmware: '2.3.7', signal: 3 },
  { id: 'D-0004', name: 'Tank Monitor 7', status: 'offline', lastSeen: '2026-05-10 23:42', firmware: '2.3.9', signal: 0 },
  { id: 'D-0005', name: 'Fleet GPS 18', status: 'online', lastSeen: '2026-05-11 19:14', firmware: '2.4.1', signal: 4 },
  { id: 'D-0006', name: 'Asset Tag 221', status: 'online', lastSeen: '2026-05-11 19:09', firmware: '2.4.0', signal: 2 },
  { id: 'D-0007', name: 'Pole Sensor 4', status: 'alert', lastSeen: '2026-05-11 18:55', firmware: '2.3.7', signal: 3 },
  { id: 'D-0008', name: 'Edge Router B', status: 'online', lastSeen: '2026-05-11 19:14', firmware: '2.4.1', signal: 5 },
];

@Component({
  selector: 'fl-dashboard',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  readonly devices = DEVICES;
  readonly filter = signal<StatusFilter>('all');

  readonly visibleDevices = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.devices : this.devices.filter((d) => d.status === f);
  });

  readonly kpis = computed(() => {
    const total = this.devices.length;
    const online = this.devices.filter((d) => d.status === 'online').length;
    const alerts = this.devices.filter((d) => d.status === 'alert').length;
    const pending = this.devices.filter((d) => d.firmware !== '2.4.1').length;
    return { total, online, alerts, pending };
  });

  /** Five-bar signal strength rendered as five `<span>` segments. */
  readonly bars = [1, 2, 3, 4, 5] as const;
}
