const bluetooth = (() => {
  let device    = null;
  let rxChar    = null;
  let buffer    = '';
  let simTimer  = null;
  let _onData   = null;
  let _onStatus = null;

  function setStatus(s) { _onStatus?.(s); }

  function parseAndDispatch(line) {
    const parts = line.trim().split(',').map(Number);
    // Accept 7 values: FSR[0-3] + roll[4] + pitch[5] + yaw[6]
    // Also accept 4 values (FSR-only legacy): pad with zeros
    if (parts.some(v => isNaN(v))) return;
    if (parts.length === 7) {
      _onData?.(parts);
    } else if (parts.length === 4) {
      _onData?.([...parts, 0, 0, 0]);
    }
  }

  function onRx(event) {
    buffer += new TextDecoder().decode(event.target.value);
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(parseAndDispatch);
  }

  return {
    set onData(fn)   { _onData   = fn; },
    set onStatus(fn) { _onStatus = fn; },

    status: 'disconnected',

    async connect() {
      if (!navigator.bluetooth) {
        setStatus('unsupported');
        return;
      }
      try {
        setStatus('scanning');
        device = await navigator.bluetooth.requestDevice({
          filters: [
            { name: 'OnyxSDI' },
            { services: [BLE_UART.service] },
          ],
          optionalServices: [BLE_UART.service],
        });
        device.addEventListener('gattserverdisconnected', () => {
          this.status = 'disconnected';
          setStatus('disconnected');
        });
        setStatus('connecting');
        const server = await device.gatt.connect();
        const svc    = await server.getPrimaryService(BLE_UART.service);
        rxChar        = await svc.getCharacteristic(BLE_UART.rx);
        await rxChar.startNotifications();
        rxChar.addEventListener('characteristicvaluechanged', onRx);
        this.status = 'connected';
        setStatus('connected');
      } catch (err) {
        this.status = 'error';
        setStatus('error');
        console.error('[BT]', err);
      }
    },

    disconnect() {
      this.stopSimulation();
      if (device?.gatt?.connected) device.gatt.disconnect();
      this.status = 'disconnected';
      setStatus('disconnected');
    },

    isConnected() { return device?.gatt?.connected ?? false; },

    /* ── Simulation (no hardware) ────────────────────────── */
    startSimulation(drill) {
      this.stopSimulation();
      this.status = 'simulating';
      setStatus('simulating');

      // FSR base values for P1-P4; IMU base angles (yaw, pitch, roll)
      const fsrBase = [200, 300, 280, 100];
      let simYaw = 2;   // slight toe-out to start

      simTimer = setInterval(() => {
        const fsr = fsrBase.map((base, i) => {
          const pid = `P${i + 1}`;
          const pt  = drill?.points?.find(p => p.id === pid);
          if (!pt) return base + Math.round((Math.random() - 0.5) * 40);
          const noise = Math.round((Math.random() - 0.5) * 80);
          const spike = Math.random() < 0.08 ? (pt.direction === 'positive' ? -80 : 80) : 0;
          return Math.max(0, Math.min(MAX_SENSOR_VAL, pt.thr + noise + spike));
        });
        // Simulate slow yaw drift + occasional spike
        simYaw += (Math.random() - 0.48) * 0.5;
        const yawSpike = Math.random() < 0.05 ? (Math.random() < 0.5 ? 12 : -12) : 0;
        const roll  = Math.round((Math.random() - 0.5) * 1 * 10) / 10;
        const pitch = Math.round((Math.random() - 0.5) * 2 * 10) / 10;
        const yaw   = Math.round((simYaw + yawSpike) * 10) / 10;
        _onData?.([...fsr, roll, pitch, yaw]);
      }, 100);
    },

    stopSimulation() {
      if (simTimer) { clearInterval(simTimer); simTimer = null; }
      if (this.status === 'simulating') {
        this.status = 'disconnected';
        setStatus('disconnected');
      }
    },

    isSimulating() { return simTimer !== null; },
  };
})();
