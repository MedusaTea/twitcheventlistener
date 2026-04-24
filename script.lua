local socket = require("socket")
local HOLD_FRAMES = 8
local BUTTON_MAP = {
  up     = "Up",
  down   = "Down",
  left   = "Left",
  right  = "Right",
  a      = "A",
  b      = "B",
  start  = "Start",
  select = "Select",
}
local sock = nil
local current_button = nil
local hold_counter = 0

local function connect()
  sock = socket.tcp()
  sock:settimeout(0)
  sock:connect("127.0.0.1", 8888)
  print("[TPP] Connected to Node.js")
end

local function read_commands()
  if not sock then return end
  -- use "*l" line mode instead of byte count — much more reliable in BizHawk
  local line, err = sock:receive("*l")
  if line then
    print("[TPP] received: " .. line)
    local cmd = line:match("^%s*(.-)%s*$")
    local btn = BUTTON_MAP[cmd]
    if btn and hold_counter == 0 then
      current_button = btn
      hold_counter = HOLD_FRAMES
      print("[TPP] Pressing: " .. btn)
    end
  elseif err == "closed" then
    print("[TPP] Connection closed — reconnecting...")
    sock:close()
    sock = nil
    connect()
  elseif err ~= "timeout" then
    print("[TPP] Socket error: " .. tostring(err) .. " — reconnecting...")
    sock:close()
    sock = nil
    connect()
  end
end

local function on_frame()
  read_commands()
  if current_button and hold_counter > 0 then
    joypad.set({ [current_button] = true })
    hold_counter = hold_counter - 1
    if hold_counter == 0 then
      joypad.set({ [current_button] = false })
      current_button = nil
    end
  end
end

connect()
event.onframestart(on_frame)
print("[TPP] Waiting for inputs...")
