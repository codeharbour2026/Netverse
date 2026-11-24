# NETVERSE — Lab 0.1

A browser-based 3D network laboratory. Build a tiny virtual LAN, connect computers, routers and servers, then send simulated packets through the network.

## Run it

Because the project uses JavaScript ES modules and Three.js, run it through a local web server rather than opening `index.html` directly.

### Option A: Python (usually already installed on macOS)

1. Extract the ZIP.
2. Open Terminal.
3. Change into the `netverse-lab` folder. For example:

   ```bash
   cd ~/Downloads/netverse-lab
   ```

4. Start the server:

   ```bash
   python3 -m http.server 8000
   ```

5. Open this address in your browser:

   `http://localhost:8000`

6. Keep Terminal open while using NETVERSE. Press `Control + C` to stop the server.

### Option B: VS Code

Open the folder in VS Code and use a local development server extension that serves `index.html`.

## Controls

- Drag: orbit camera
- Scroll: zoom
- V: select
- 1: place computer
- 2: place router
- 3: place server
- C: connect two devices
- Escape: return to select mode

## How to use

1. Click **Build sample network** to create a working example.
2. Choose **Connect** and click two devices to create a cable.
3. Select a device in the 3D scene.
4. In the inspector, choose a destination and send a test packet.
5. Watch the glowing packet travel along the route.
6. Rename devices or edit their IPv4 addresses in the inspector.
7. Use **Save lab** to store the current setup in this browser.

## Notes

- The simulation is local to the browser. It does not send real network traffic.
- Packet routing currently uses breadth-first search over the connected links.
- The 3D library and font are loaded from public CDNs, so the first run requires an internet connection.
- Saved labs are stored in this browser's local storage.

## Planned next steps

- Subnets and subnet masks
- Routing tables and configurable routing metrics
- Switches and network interfaces
- Bandwidth, latency and packet loss
- DNS and simulated HTTP
- Virtual data centres and hosted websites
- Shared worlds / multiplayer
