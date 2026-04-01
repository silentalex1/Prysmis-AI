local BASE_URL = "http://prysmisai.wtf"
local POLL_INTERVAL = 2
local plugin = plugin
local toolbar = plugin:CreateToolbar("PrysmisAI")
local toggleButton = toolbar:CreateButton("PrysmisAI", "Open PrysmisAI Panel", "")

local PluginGuiService = game:GetService("PluginGuiService")
local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
local Selection = game:GetService("Selection")

local dockGui = plugin:CreateDockWidgetPluginGui(
	"PrysmisAIDock",
	DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, false, false, 500, 520, 400, 420)
)
dockGui.Title = "PrysmisAI"
dockGui.Name = "PrysmisAIDock"

local connected = false
local sessionToken = ""
local sessionUser = ""
local sessionModel = ""
local pollConnection = nil
local pendingCommands = {}

local function buildUI()
	for _, v in ipairs(dockGui:GetChildren()) do
		v:Destroy()
	end

	local bg = Instance.new("Frame")
	bg.Size = UDim2.new(1, 0, 1, 0)
	bg.BackgroundColor3 = Color3.fromRGB(15, 15, 18)
	bg.BorderSizePixel = 0
	bg.Parent = dockGui

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 0)
	corner.Parent = bg

	local topBar = Instance.new("Frame")
	topBar.Size = UDim2.new(1, 0, 0, 48)
	topBar.Position = UDim2.new(0, 0, 0, 0)
	topBar.BackgroundColor3 = Color3.fromRGB(20, 20, 24)
	topBar.BorderSizePixel = 0
	topBar.Parent = bg

	local topBorder = Instance.new("Frame")
	topBorder.Size = UDim2.new(1, 0, 0, 1)
	topBorder.Position = UDim2.new(0, 0, 1, -1)
	topBorder.BackgroundColor3 = Color3.fromRGB(40, 40, 48)
	topBorder.BorderSizePixel = 0
	topBorder.Parent = topBar

	local titleLabel = Instance.new("TextLabel")
	titleLabel.Size = UDim2.new(0, 120, 1, 0)
	titleLabel.Position = UDim2.new(0, 16, 0, 0)
	titleLabel.BackgroundTransparency = 1
	titleLabel.Text = "PrysmisAI"
	titleLabel.TextColor3 = Color3.fromRGB(240, 236, 229)
	titleLabel.Font = Enum.Font.GothamBold
	titleLabel.TextSize = 16
	titleLabel.TextXAlignment = Enum.TextXAlignment.Left
	titleLabel.Parent = topBar

	local betaBadge = Instance.new("TextLabel")
	betaBadge.Size = UDim2.new(0, 44, 0, 20)
	betaBadge.Position = UDim2.new(0, 138, 0.5, -10)
	betaBadge.BackgroundColor3 = Color3.fromRGB(212, 120, 78)
	betaBadge.Text = "BETA"
	betaBadge.TextColor3 = Color3.fromRGB(255, 255, 255)
	betaBadge.Font = Enum.Font.GothamBold
	betaBadge.TextSize = 10
	betaBadge.Parent = topBar

	local badgeCorner = Instance.new("UICorner")
	badgeCorner.CornerRadius = UDim.new(0, 5)
	badgeCorner.Parent = betaBadge

	local scroll = Instance.new("ScrollingFrame")
	scroll.Size = UDim2.new(1, 0, 1, -48)
	scroll.Position = UDim2.new(0, 0, 0, 48)
	scroll.BackgroundTransparency = 1
	scroll.BorderSizePixel = 0
	scroll.ScrollBarThickness = 4
	scroll.ScrollBarImageColor3 = Color3.fromRGB(60, 60, 70)
	scroll.CanvasSize = UDim2.new(0, 0, 0, 0)
	scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
	scroll.Parent = bg

	local listLayout = Instance.new("UIListLayout")
	listLayout.SortOrder = Enum.SortOrder.LayoutOrder
	listLayout.Padding = UDim.new(0, 10)
	listLayout.Parent = scroll

	local padding = Instance.new("UIPadding")
	padding.PaddingLeft = UDim.new(0, 14)
	padding.PaddingRight = UDim.new(0, 14)
	padding.PaddingTop = UDim.new(0, 14)
	padding.PaddingBottom = UDim.new(0, 14)
	padding.Parent = scroll

	local function makeCard()
		local card = Instance.new("Frame")
		card.Size = UDim2.new(1, 0, 0, 0)
		card.AutomaticSize = Enum.AutomaticSize.Y
		card.BackgroundColor3 = Color3.fromRGB(22, 22, 28)
		card.BorderSizePixel = 0

		local cc = Instance.new("UICorner")
		cc.CornerRadius = UDim.new(0, 10)
		cc.Parent = card

		local cborder = Instance.new("UIStroke")
		cborder.Color = Color3.fromRGB(40, 40, 50)
		cborder.Thickness = 1
		cborder.Parent = card

		local cp = Instance.new("UIPadding")
		cp.PaddingLeft = UDim.new(0, 14)
		cp.PaddingRight = UDim.new(0, 14)
		cp.PaddingTop = UDim.new(0, 14)
		cp.PaddingBottom = UDim.new(0, 14)
		cp.Parent = card

		local cl = Instance.new("UIListLayout")
		cl.SortOrder = Enum.SortOrder.LayoutOrder
		cl.Padding = UDim.new(0, 10)
		cl.Parent = card

		return card
	end

	local function makeSeparator(parent, order)
		local sep = Instance.new("Frame")
		sep.Size = UDim2.new(1, 0, 0, 1)
		sep.BackgroundColor3 = Color3.fromRGB(35, 35, 42)
		sep.BorderSizePixel = 0
		sep.LayoutOrder = order
		sep.Parent = parent
	end

	local function makeRow(parent, labelText, valueText, order)
		local row = Instance.new("Frame")
		row.Size = UDim2.new(1, 0, 0, 28)
		row.BackgroundTransparency = 1
		row.LayoutOrder = order
		row.Parent = parent

		local lbl = Instance.new("TextLabel")
		lbl.Size = UDim2.new(0.38, 0, 1, 0)
		lbl.BackgroundTransparency = 1
		lbl.Text = labelText
		lbl.TextColor3 = Color3.fromRGB(120, 116, 110)
		lbl.Font = Enum.Font.Gotham
		lbl.TextSize = 13
		lbl.TextXAlignment = Enum.TextXAlignment.Left
		lbl.Parent = row

		local val = Instance.new("TextLabel")
		val.Size = UDim2.new(0.62, 0, 1, 0)
		val.Position = UDim2.new(0.38, 0, 0, 0)
		val.BackgroundTransparency = 1
		val.Text = valueText
		val.Font = Enum.Font.GothamBold
		val.TextSize = 13
		val.TextXAlignment = Enum.TextXAlignment.Left
		val.Parent = row

		return val
	end

	local infoCard = makeCard()
	infoCard.LayoutOrder = 1
	infoCard.Parent = scroll

	local statusRow = Instance.new("Frame")
	statusRow.Size = UDim2.new(1, 0, 0, 28)
	statusRow.BackgroundTransparency = 1
	statusRow.LayoutOrder = 1
	statusRow.Parent = infoCard

	local statusLbl = Instance.new("TextLabel")
	statusLbl.Size = UDim2.new(0.38, 0, 1, 0)
	statusLbl.BackgroundTransparency = 1
	statusLbl.Text = "Status"
	statusLbl.TextColor3 = Color3.fromRGB(120, 116, 110)
	statusLbl.Font = Enum.Font.Gotham
	statusLbl.TextSize = 13
	statusLbl.TextXAlignment = Enum.TextXAlignment.Left
	statusLbl.Parent = statusRow

	local statusDot = Instance.new("Frame")
	statusDot.Size = UDim2.new(0, 8, 0, 8)
	statusDot.Position = UDim2.new(0.38, 0, 0.5, -4)
	statusDot.BackgroundColor3 = connected and Color3.fromRGB(76, 175, 125) or Color3.fromRGB(180, 60, 60)
	statusDot.BorderSizePixel = 0
	statusDot.Parent = statusRow

	local dotCorner = Instance.new("UICorner")
	dotCorner.CornerRadius = UDim.new(1, 0)
	dotCorner.Parent = statusDot

	local statusVal = Instance.new("TextLabel")
	statusVal.Size = UDim2.new(0.55, 0, 1, 0)
	statusVal.Position = UDim2.new(0.38, 14, 0, 0)
	statusVal.BackgroundTransparency = 1
	statusVal.Text = connected and "Connected" or "Disconnected"
	statusVal.TextColor3 = connected and Color3.fromRGB(76, 175, 125) or Color3.fromRGB(180, 60, 60)
	statusVal.Font = Enum.Font.GothamBold
	statusVal.TextSize = 13
	statusVal.TextXAlignment = Enum.TextXAlignment.Left
	statusVal.Parent = statusRow

	makeSeparator(infoCard, 2)

	local modelVal = makeRow(infoCard, "AI Model", connected and sessionModel or "—", 3)
	modelVal.TextColor3 = Color3.fromRGB(91, 156, 246)

	makeSeparator(infoCard, 4)

	local userVal = makeRow(infoCard, "User", connected and sessionUser or "—", 5)
	userVal.TextColor3 = Color3.fromRGB(240, 236, 229)

	local tokenCard = makeCard()
	tokenCard.LayoutOrder = 2
	tokenCard.Parent = scroll

	local tokenBox = Instance.new("TextBox")
	tokenBox.Size = UDim2.new(1, 0, 0, 38)
	tokenBox.BackgroundColor3 = Color3.fromRGB(28, 28, 34)
	tokenBox.BorderSizePixel = 0
	tokenBox.Text = ""
	tokenBox.PlaceholderText = "Paste plugin token from website..."
	tokenBox.PlaceholderColor3 = Color3.fromRGB(80, 78, 74)
	tokenBox.TextColor3 = Color3.fromRGB(220, 216, 210)
	tokenBox.Font = Enum.Font.Code
	tokenBox.TextSize = 12
	tokenBox.ClearTextOnFocus = false
	tokenBox.LayoutOrder = 1
	tokenBox.Parent = tokenCard

	local tbCorner = Instance.new("UICorner")
	tbCorner.CornerRadius = UDim.new(0, 8)
	tbCorner.Parent = tokenBox

	local tbStroke = Instance.new("UIStroke")
	tbStroke.Color = Color3.fromRGB(50, 50, 60)
	tbStroke.Thickness = 1
	tbStroke.Parent = tokenBox

	local tbPad = Instance.new("UIPadding")
	tbPad.PaddingLeft = UDim.new(0, 10)
	tbPad.PaddingRight = UDim.new(0, 10)
	tbPad.Parent = tokenBox

	local statusMsgLabel = Instance.new("TextLabel")
	statusMsgLabel.Size = UDim2.new(1, 0, 0, 0)
	statusMsgLabel.AutomaticSize = Enum.AutomaticSize.Y
	statusMsgLabel.BackgroundTransparency = 1
	statusMsgLabel.Text = ""
	statusMsgLabel.TextColor3 = Color3.fromRGB(224, 85, 85)
	statusMsgLabel.Font = Enum.Font.Gotham
	statusMsgLabel.TextSize = 11
	statusMsgLabel.TextXAlignment = Enum.TextXAlignment.Left
	statusMsgLabel.TextWrapped = true
	statusMsgLabel.LayoutOrder = 2
	statusMsgLabel.Visible = false
	statusMsgLabel.Parent = tokenCard

	local connectBtn = Instance.new("TextButton")
	connectBtn.Size = UDim2.new(1, 0, 0, 42)
	connectBtn.BackgroundColor3 = connected and Color3.fromRGB(40, 100, 80) or Color3.fromRGB(212, 120, 78)
	connectBtn.Text = connected and "Disconnect" or "Connect"
	connectBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
	connectBtn.Font = Enum.Font.GothamBold
	connectBtn.TextSize = 14
	connectBtn.BorderSizePixel = 0
	connectBtn.LayoutOrder = 3
	connectBtn.Parent = tokenCard

	local cbCorner = Instance.new("UICorner")
	cbCorner.CornerRadius = UDim.new(0, 9)
	cbCorner.Parent = connectBtn

	local sendFilesBtn = Instance.new("TextButton")
	sendFilesBtn.Size = UDim2.new(1, 0, 0, 42)
	sendFilesBtn.BackgroundColor3 = Color3.fromRGB(30, 80, 130)
	sendFilesBtn.Text = "Send files to website"
	sendFilesBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
	sendFilesBtn.Font = Enum.Font.GothamBold
	sendFilesBtn.TextSize = 14
	sendFilesBtn.BorderSizePixel = 0
	sendFilesBtn.LayoutOrder = 4
	sendFilesBtn.Visible = connected
	sendFilesBtn.Parent = tokenCard

	local sfCorner = Instance.new("UICorner")
	sfCorner.CornerRadius = UDim.new(0, 9)
	sfCorner.Parent = sendFilesBtn

	local commandCard = makeCard()
	commandCard.LayoutOrder = 3
	commandCard.Visible = connected
	commandCard.Parent = scroll

	local cmdTitle = Instance.new("TextLabel")
	cmdTitle.Size = UDim2.new(1, 0, 0, 20)
	cmdTitle.BackgroundTransparency = 1
	cmdTitle.Text = "AI Actions"
	cmdTitle.TextColor3 = Color3.fromRGB(240, 236, 229)
	cmdTitle.Font = Enum.Font.GothamBold
	cmdTitle.TextSize = 13
	cmdTitle.TextXAlignment = Enum.TextXAlignment.Left
	cmdTitle.LayoutOrder = 1
	cmdTitle.Parent = commandCard

	local cmdStatus = Instance.new("TextLabel")
	cmdStatus.Size = UDim2.new(1, 0, 0, 0)
	cmdStatus.AutomaticSize = Enum.AutomaticSize.Y
	cmdStatus.BackgroundTransparency = 1
	cmdStatus.Text = "Waiting for AI commands..."
	cmdStatus.TextColor3 = Color3.fromRGB(100, 96, 90)
	cmdStatus.Font = Enum.Font.Gotham
	cmdStatus.TextSize = 12
	cmdStatus.TextXAlignment = Enum.TextXAlignment.Left
	cmdStatus.TextWrapped = true
	cmdStatus.LayoutOrder = 2
	cmdStatus.Parent = commandCard

	local function updateStatus()
		statusDot.BackgroundColor3 = connected and Color3.fromRGB(76, 175, 125) or Color3.fromRGB(180, 60, 60)
		statusVal.Text = connected and "Connected" or "Disconnected"
		statusVal.TextColor3 = connected and Color3.fromRGB(76, 175, 125) or Color3.fromRGB(180, 60, 60)
		modelVal.Text = connected and sessionModel or "—"
		userVal.Text = connected and sessionUser or "—"
		connectBtn.Text = connected and "Disconnect" or "Connect"
		connectBtn.BackgroundColor3 = connected and Color3.fromRGB(40, 100, 80) or Color3.fromRGB(212, 120, 78)
		sendFilesBtn.Visible = connected
		commandCard.Visible = connected
	end

	local function serializeInstance(inst, depth)
		if depth > 6 then return nil end
		local data = {
			name = inst.Name,
			className = inst.ClassName,
			properties = {},
			children = {}
		}
		local ok, props = pcall(function()
			local p = {}
			if inst:IsA("BasePart") then
				p.Size = tostring(inst.Size)
				p.Position = tostring(inst.Position)
				p.Rotation = tostring(inst.Rotation)
				p.Anchored = tostring(inst.Anchored)
				p.BrickColor = tostring(inst.BrickColor)
				p.Material = tostring(inst.Material)
				p.Transparency = tostring(inst.Transparency)
				p.CanCollide = tostring(inst.CanCollide)
				p.CastShadow = tostring(inst.CastShadow)
			end
			if inst:IsA("Model") then
				p.PrimaryPart = inst.PrimaryPart and inst.PrimaryPart.Name or "nil"
			end
			if inst:IsA("Script") or inst:IsA("LocalScript") or inst:IsA("ModuleScript") then
				local s, src = pcall(function() return inst.Source end)
				if s then p.Source = src end
				p.Disabled = tostring(inst.Disabled)
			end
			if inst:IsA("StringValue") or inst:IsA("NumberValue") or inst:IsA("BoolValue") or inst:IsA("IntValue") then
				p.Value = tostring(inst.Value)
			end
			if inst:IsA("Sound") then
				p.SoundId = inst.SoundId
				p.Volume = tostring(inst.Volume)
				p.Looped = tostring(inst.Looped)
			end
			if inst:IsA("SpecialMesh") or inst:IsA("SelectionBox") then
				p.MeshType = tostring(inst:IsA("SpecialMesh") and inst.MeshType or "")
			end
			if inst:IsA("Lighting") then
				p.Ambient = tostring(inst.Ambient)
				p.Brightness = tostring(inst.Brightness)
				p.GlobalShadows = tostring(inst.GlobalShadows)
				p.TimeOfDay = inst.TimeOfDay
				p.ClockTime = tostring(inst.ClockTime)
				p.FogColor = tostring(inst.FogColor)
				p.FogEnd = tostring(inst.FogEnd)
				p.FogStart = tostring(inst.FogStart)
			end
			if inst:IsA("Folder") or inst:IsA("Configuration") then
			end
			return p
		end)
		if ok then data.properties = props end
		for _, child in ipairs(inst:GetChildren()) do
			local childData = serializeInstance(child, depth + 1)
			if childData then
				table.insert(data.children, childData)
			end
		end
		return data
	end

	local function gatherStudioFiles()
		local services = {
			"Workspace",
			"Players",
			"Lighting",
			"MaterialService",
			"ReplicatedFirst",
			"ReplicatedStorage",
			"ServerScriptService",
			"ServerStorage",
			"StarterGui",
			"StarterPack",
			"StarterPlayer",
			"Teams",
			"SoundService",
			"TextChatService"
		}
		local result = {}
		for _, svcName in ipairs(services) do
			local ok, svc = pcall(function() return game:GetService(svcName) end)
			if ok and svc then
				local data = serializeInstance(svc, 0)
				if data then
					result[svcName] = data
				end
			end
		end
		return result
	end

	local function applyCommand(cmd)
		if not cmd or not cmd.action then return false, "No action" end
		local action = cmd.action

		if action == "create_part" then
			local ok, err = pcall(function()
				local part = Instance.new("Part")
				part.Name = cmd.name or "AIPart"
				part.Size = cmd.size and Vector3.new(cmd.size[1], cmd.size[2], cmd.size[3]) or Vector3.new(4, 1, 4)
				part.Position = cmd.position and Vector3.new(cmd.position[1], cmd.position[2], cmd.position[3]) or Vector3.new(0, 5, 0)
				part.Anchored = cmd.anchored ~= nil and cmd.anchored or true
				if cmd.color then
					part.BrickColor = BrickColor.new(cmd.color)
				end
				if cmd.material then
					local mok, mat = pcall(function() return Enum.Material[cmd.material] end)
					if mok and mat then part.Material = mat end
				end
				part.Parent = workspace
			end)
			if not ok then return false, tostring(err) end
			return true, "Created part"

		elseif action == "create_script" then
			local ok, err = pcall(function()
				local sType = cmd.scriptType or "Script"
				local s
				if sType == "LocalScript" then
					s = Instance.new("LocalScript")
				elseif sType == "ModuleScript" then
					s = Instance.new("ModuleScript")
				else
					s = Instance.new("Script")
				end
				s.Name = cmd.name or "AIScript"
				s.Source = cmd.source or ""
				local targetName = cmd.parent or "ServerScriptService"
				local ok2, target = pcall(function() return game:GetService(targetName) end)
				if ok2 and target then
					s.Parent = target
				else
					s.Parent = game:GetService("ServerScriptService")
				end
			end)
			if not ok then return false, tostring(err) end
			return true, "Created script"

		elseif action == "create_model" then
			local ok, err = pcall(function()
				local model = Instance.new("Model")
				model.Name = cmd.name or "AIModel"
				local targetName = cmd.parent or "Workspace"
				local ok2, target = pcall(function() return game:GetService(targetName) end)
				if ok2 and target then
					model.Parent = target
				else
					model.Parent = workspace
				end
			end)
			if not ok then return false, tostring(err) end
			return true, "Created model"

		elseif action == "delete_instance" then
			local ok, err = pcall(function()
				local path = cmd.path
				if not path then return end
				local parts = string.split(path, ".")
				local current = game
				for i, part in ipairs(parts) do
					if i == 1 then
						local s, svc = pcall(function() return game:GetService(part) end)
						if s then current = svc else current = current:FindFirstChild(part) end
					else
						if current then current = current:FindFirstChild(part) end
					end
					if not current then break end
				end
				if current and current ~= game then
					current:Destroy()
				end
			end)
			if not ok then return false, tostring(err) end
			return true, "Deleted instance"

		elseif action == "modify_property" then
			local ok, err = pcall(function()
				local path = cmd.path
				if not path then return end
				local parts = string.split(path, ".")
				local current = game
				for i, part in ipairs(parts) do
					if i == 1 then
						local s, svc = pcall(function() return game:GetService(part) end)
						if s then current = svc else current = current:FindFirstChild(part) end
					else
						if current then current = current:FindFirstChild(part) end
					end
					if not current then break end
				end
				if current and cmd.property and cmd.value ~= nil then
					current[cmd.property] = cmd.value
				end
			end)
			if not ok then return false, tostring(err) end
			return true, "Modified property"

		elseif action == "create_gui" then
			local ok, err = pcall(function()
				local screenGui = Instance.new("ScreenGui")
				screenGui.Name = cmd.name or "AIGUI"
				screenGui.ResetOnSpawn = false
				local targetName = cmd.parent or "StarterGui"
				local ok2, target = pcall(function() return game:GetService(targetName) end)
				if ok2 and target then screenGui.Parent = target else screenGui.Parent = game:GetService("StarterGui") end
				if cmd.children then
					local function buildGuiTree(parentInst, children)
						for _, childDef in ipairs(children) do
							local elOk, el = pcall(function() return Instance.new(childDef.className) end)
							if elOk and el then
								el.Parent = parentInst
								if childDef.properties then
									for prop, val in pairs(childDef.properties) do
										pcall(function() el[prop] = val end)
									end
								end
								if childDef.children then
									buildGuiTree(el, childDef.children)
								end
							end
						end
					end
					buildGuiTree(screenGui, cmd.children)
				end
			end)
			if not ok then return false, tostring(err) end
			return true, "Created GUI"

		elseif action == "create_terrain" then
			local ok, err = pcall(function()
				local terrain = workspace:FindFirstChildOfClass("Terrain")
				if not terrain then return end
				local regionCenter = cmd.center and Vector3.new(cmd.center[1], cmd.center[2], cmd.center[3]) or Vector3.new(0, 0, 0)
				local regionSize = cmd.size and Vector3.new(cmd.size[1], cmd.size[2], cmd.size[3]) or Vector3.new(512, 50, 512)
				local region = Region3.new(
					regionCenter - regionSize / 2,
					regionCenter + regionSize / 2
				)
				local materialName = cmd.material or "Grass"
				local mat = Enum.Material[materialName] or Enum.Material.Grass
				terrain:FillBlock(CFrame.new(regionCenter), regionSize, mat)
			end)
			if not ok then return false, tostring(err) end
			return true, "Created terrain"

		elseif action == "batch" then
			local results = {}
			if cmd.commands then
				for _, subCmd in ipairs(cmd.commands) do
					local s, r = applyCommand(subCmd)
					table.insert(results, { success = s, result = r })
				end
			end
			return true, "Batch done: " .. #results .. " commands"

		end

		return false, "Unknown action: " .. tostring(action)
	end

	local function pollCommands()
		if not connected or sessionToken == "" then return end
		local ok, response = pcall(function()
			return HttpService:RequestAsync({
				Url = BASE_URL .. "/api/studio/poll?token=" .. sessionToken,
				Method = "GET",
				Headers = { ["Content-Type"] = "application/json" }
			})
		end)
		if not ok then return end
		if response.StatusCode ~= 200 then return end
		local parseOk, data = pcall(function()
			return HttpService:JSONDecode(response.Body)
		end)
		if not parseOk or not data then return end
		if data.commands and type(data.commands) == "table" then
			for _, cmd in ipairs(data.commands) do
				local s, r = applyCommand(cmd)
				cmdStatus.Text = (s and "[Done] " or "[Fail] ") .. (cmd.action or "?") .. ": " .. tostring(r)
				local reportOk = pcall(function()
					HttpService:RequestAsync({
						Url = BASE_URL .. "/api/studio/ack",
						Method = "POST",
						Headers = { ["Content-Type"] = "application/json" },
						Body = HttpService:JSONEncode({
							token = sessionToken,
							commandId = cmd.id,
							success = s,
							result = tostring(r)
						})
					})
				end)
			end
		end
	end

	connectBtn.MouseButton1Click:Connect(function()
		if connected then
			connected = false
			sessionToken = ""
			sessionUser = ""
			sessionModel = ""
			if pollConnection then
				pollConnection:Disconnect()
				pollConnection = nil
			end
			statusMsgLabel.Text = ""
			statusMsgLabel.Visible = false
			updateStatus()
		else
			local token = tokenBox.Text:match("^%s*(.-)%s*$")
			if token == "" then
				statusMsgLabel.Text = "Please paste your plugin token from the website settings."
				statusMsgLabel.Visible = true
				return
			end
			statusMsgLabel.Text = "Connecting..."
			statusMsgLabel.TextColor3 = Color3.fromRGB(150, 146, 140)
			statusMsgLabel.Visible = true
			local ok, response = pcall(function()
				return HttpService:RequestAsync({
					Url = BASE_URL .. "/api/studio/connect",
					Method = "POST",
					Headers = { ["Content-Type"] = "application/json" },
					Body = HttpService:JSONEncode({ token = token })
				})
			end)
			if not ok then
				statusMsgLabel.Text = "Connection failed. Check if the website is online."
				statusMsgLabel.TextColor3 = Color3.fromRGB(224, 85, 85)
				return
			end
			if response.StatusCode == 200 then
				local parseOk, data = pcall(function() return HttpService:JSONDecode(response.Body) end)
				if parseOk and data and data.success then
					connected = true
					sessionToken = token
					sessionUser = data.username or "Unknown"
					sessionModel = data.model or "claude-opus-4-5"
					statusMsgLabel.Text = ""
					statusMsgLabel.Visible = false
					updateStatus()
					pollConnection = RunService.Heartbeat:Connect(function()
						pollCommands()
						task.wait(POLL_INTERVAL)
					end)
				else
					statusMsgLabel.Text = "Invalid token or server error."
					statusMsgLabel.TextColor3 = Color3.fromRGB(224, 85, 85)
					statusMsgLabel.Visible = true
				end
			elseif response.StatusCode == 401 then
				statusMsgLabel.Text = "Invalid token. Generate a new one in website settings."
				statusMsgLabel.TextColor3 = Color3.fromRGB(224, 85, 85)
				statusMsgLabel.Visible = true
			else
				statusMsgLabel.Text = "Server error (" .. tostring(response.StatusCode) .. "). Try again."
				statusMsgLabel.TextColor3 = Color3.fromRGB(224, 85, 85)
				statusMsgLabel.Visible = true
			end
		end
	end)

	sendFilesBtn.MouseButton1Click:Connect(function()
		if not connected or sessionToken == "" then return end
		sendFilesBtn.Text = "Sending..."
		sendFilesBtn.BackgroundColor3 = Color3.fromRGB(30, 50, 80)
		local files = gatherStudioFiles()
		local ok, response = pcall(function()
			return HttpService:RequestAsync({
				Url = BASE_URL .. "/api/studio/files",
				Method = "POST",
				Headers = { ["Content-Type"] = "application/json" },
				Body = HttpService:JSONEncode({
					token = sessionToken,
					files = files
				})
			})
		end)
		if ok and response.StatusCode == 200 then
			sendFilesBtn.Text = "Files sent!"
			sendFilesBtn.BackgroundColor3 = Color3.fromRGB(40, 120, 80)
			task.delay(2, function()
				sendFilesBtn.Text = "Send files to website"
				sendFilesBtn.BackgroundColor3 = Color3.fromRGB(30, 80, 130)
			end)
		else
			sendFilesBtn.Text = "Send failed. Retry."
			sendFilesBtn.BackgroundColor3 = Color3.fromRGB(120, 40, 40)
			task.delay(2, function()
				sendFilesBtn.Text = "Send files to website"
				sendFilesBtn.BackgroundColor3 = Color3.fromRGB(30, 80, 130)
			end)
		end
	end)
end

toggleButton.Click:Connect(function()
	dockGui.Enabled = not dockGui.Enabled
	if dockGui.Enabled then
		buildUI()
	end
end)

buildUI()
