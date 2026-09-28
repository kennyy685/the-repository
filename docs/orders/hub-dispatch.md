# Hub dispatch (FilthE, 2026-09-28)

"What would be the point of the agents if you do all the work? You focus on the main work, the hard work."

- Hub Chat answers FilthE instantly in the page.
- An ORDER goes straight to the right robot: fire its trigger (hub doc `system/robots.dispatch`) with the order text
  + hub event id appended. Each fire = a fresh robot session that posts "on it" and the result on the hub.
  builder trig_01UEnZSXFXyE7qyBkFzsRMQs · designer trig_01SFxDK9jcrFobJrPW9GQX1A · engine trig_01TGAACRHuK4ww9x4pSLjRtX
  · research trig_01Kuk945GDiwKdjaWgxXEMX6 · qa trig_01PVGRev9d4pF9PABSNcG9XH
- Only hard/strategy calls go to the King (`system/king.wake_trigger`).
- Fixer session_01EXX2WMTpDg1ry5joJWKMAg: wire this into Hub Chat (this replaces "orders go to the King").
