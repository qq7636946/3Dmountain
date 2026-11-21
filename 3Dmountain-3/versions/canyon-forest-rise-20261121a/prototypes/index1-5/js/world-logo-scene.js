import{getSceneDaylight}from"./scene-daylight.js?v=i15-mw30beoi";import{createLightSpecks}from"./light-specks.js?v=i15-mw30beoi";export const LAKE_DEFAULTS={matchOpening:0,skyTop:"#244a70",skyMid:"#163047",skyHorizon:"#253d52",skyHaze:"#526c80",skyMidEl:7,skyTopEl:30,skyCurve:.85,hazeHeight:3.4,hazeAmount:0,sunAz:-3,sunEl:27.5,sunColor:"#ffd49a",bloomColor:"#f6c17f",sunSize:.55,sunDisc:1.1,sunBloom:.17,sunBloomSize:9,sunCore:.32,rangeOpacity:.9,rangeHeight:11,rangeWidth:54,rangeAz:5,rangeLift:-.3,rangeHaze:.12,rangeTint:"#30475a",rangeContrast:1.16,rangeSoft:.35,deep:"#0a2232",lit:"#294154",ink:"#030a11",foam:"#8eaabc",waterScale:2.22,waterSpeed:1.03,waterRough:2.71,waterStretch:1.15,waterSwell:.1,skyReflect:.62,fresnelMin:.025,fresnelPower:5,waterNearDark:.46,glintColor:"#ffd49a",glintStrength:.22,glintSize:.4,glintBand:14,glintFocus:.93,glintSpread:1.05,glintKnee:2.5,reflStrength:.32,reflLength:.7,reflRipple:1.15,reflFresnel:.68,reflBlur:.7,moteCount:22,moteSize:.55,moteSpeed:.35,moteOpacity:.24,moteColor:"#f3dfb6",speckDensity:.42,skySpecks:.16,seaRise:.42,seaAir:.02,seaSize:.46,seaOpacity:.62,seaRings:.3,seaCentre:0,orbitRandomness:67,orbitSpeed:.45,orbitRiseSpeed:1.65,orbitRadius:1.07,orbitSize:.75,orbitBrightness:.95,orbitDensity:0,orbitScatter:.2,orbitInteraction:2.15,orbitShutter:.0167,orbitSoft:1,vignette:.23,exposure:.96,outputDisplay:1,camHeight:.85,fov:36,horizon:.7,drift:.018,sway:.06,qLight:0,markY:.5,markSize:.37,markWidth:.92,shortFrom:860,shortTo:560,shortSize:.82,fovPortrait:56,portraitHorizon:.61,portraitMarkY:.375,portraitMarkSize:.255,portraitSunShift:.55,riseSink:1.12,riseCurve:.75,riseTrueFoot:1,ringAmp:.9,ringSpacing:.26,ringReach:1.7,ringSpeed:.6,ringDecay:2.6,meniscus:.8,meniscusWidth:.012,cutGlow:.6,pushAmp:.7,preset:"dusk",glacierMode:0,hills:0,hillHeight:3.2,hillScale:1,hillSharp:.6,hillSnow:"#f2f6fc",hillBlue:"#7d9ae0",rangeRock:"#6d8ede",rangeRockMix:0,cloudAmount:0,cloudScale:1,cloudSpeed:1,cloudColor:"#ffffff",mistAmount:.24,mistHeight:1.4,mistWidth:38,waterFine:.75,waterTint:.28,reflWobble:0,sparkCount:0,sparkSize:1,sparkSpeed:1,sparkColor:"#6fa4ff",lightSun:3.95,lightFill:.89,envIntensity:1.61},LAKE_ROWS=[["\u8272\u8ABF\uFF5C\u8207\u7B2C\u4E00\u5340\u584A\u540C\u6B65","matchOpening",0,1,1],["\u6C34\u6D6A\uFF5C\u6F02\u6D6E\u5E45\u5EA6","waterSwell",0,.12,.001],["\u5B57\u6A19\uFF5C\u6700\u5927\u756B\u9762\u5BEC\u5EA6","markWidth",.3,.94,.01],["\u6D77\u4E0A\u5149\u9EDE\uFF5C\u5BC6\u5EA6","speckDensity",0,1,.01],["\u6D77\u4E0A\u5149\u9EDE\uFF5C\u5F80\u4E0A\u98C4\u7684\u9AD8\u5EA6","seaRise",0,1.8,.01],["\u6D77\u4E0A\u5149\u9EDE\uFF5C\u6C34\u9762\u6F23\u6F2A","seaRings",0,1.5,.01],["\u6D77\u4E0A\u5149\u9EDE\uFF5C\u7A7A\u4E2D\u5FAE\u5149\u6BD4\u4F8B","seaAir",0,.65,.01],["\u6D77\u4E0A\u5149\u9EDE\uFF5C\u5927\u5C0F","seaSize",.1,1.5,.01],["\u6D77\u4E0A\u5149\u9EDE\uFF5C\u4E0D\u900F\u660E","seaOpacity",0,1.5,.01],["\u6D77\u4E0A\u5149\u9EDE\uFF5C\u4E2D\u592E\u6E1B\u5149\uFF080 \u5E73\u5747\u5206\u6563\uFF09","seaCentre",0,1,.01],["\u9060\u666F\u5149\u9EDE\uFF5C\u5BC6\u5EA6","skySpecks",0,1,.01],["\u96A8\u6A5F\u5E45\u5EA6\uFF08%\uFF09","orbitRandomness",0,100,1],["\u5149\u9EDE\u6578\u91CF\uFF08%\uFF09","orbitDensity",0,100,1],["\u6563\u958B\u5E45\u5EA6","orbitScatter",0,2,.05],["\u4E92\u52D5\u5F37\u5EA6","orbitInteraction",0,3,.05],["\u74B0\u7E5E\u901F\u5EA6","orbitSpeed",0,3,.05],["\u4E0A\u5347\u901F\u5EA6","orbitRiseSpeed",0,3,.05],["\u74B0\u7E5E\u7BC4\u570D","orbitRadius",.65,2,.01],["\u5149\u9EDE\u5927\u5C0F","orbitSize",.4,2,.05],["\u5149\u9EDE\u4EAE\u5EA6","orbitBrightness",0,2,.05],["\u5149\u9EDE\u67D4\u9806\uFF080 \u539F\u672C\uFF0F1 \u7D72\u6ED1\uFF09","orbitSoft",0,2,.01],["\u52D5\u614B\u6A21\u7CCA\uFF08\u79D2\uFF0C0 \u95DC\uFF09","orbitShutter",0,.05,.001],["\u5929\u7A7A\uFF5C\u9802\u90E8\u984F\u8272","skyTop"],["\u5929\u7A7A\uFF5C\u4E2D\u6BB5\u984F\u8272","skyMid"],["\u5929\u7A7A\uFF5C\u8FD1\u5730\u5E73\u7DDA\u984F\u8272","skyHorizon"],["\u5929\u7A7A\uFF5C\u5730\u5E73\u7DDA\u9727\u8272","skyHaze"],["\u5929\u7A7A\uFF5C\u4E2D\u6BB5\u9AD8\u5EA6\uFF08\u5EA6\uFF09","skyMidEl",6,40,.5],["\u5929\u7A7A\uFF5C\u9802\u90E8\u9AD8\u5EA6\uFF08\u5EA6\uFF09","skyTopEl",30,85,1],["\u5929\u7A7A\uFF5C\u6F38\u5C64\u66F2\u7DDA","skyCurve",.4,2.2,.01],["\u5929\u7A7A\uFF5C\u5730\u5E73\u7DDA\u9727 \u9AD8\u5EA6\uFF08\u5EA6\uFF09","hazeHeight",1,14,.1],["\u5929\u7A7A\uFF5C\u5730\u5E73\u7DDA\u9727 \u6FC3\u5EA6","hazeAmount",0,1,.01],["\u592A\u967D\uFF5C\u65B9\u4F4D\uFF08\u5EA6\uFF0C\u8CA0\uFF1D\u5DE6\uFF09","sunAz",-70,40,.5],["\u592A\u967D\uFF5C\u9AD8\u5EA6\uFF08\u5EA6\uFF09","sunEl",-3,50,.1],["\u592A\u967D\uFF5C\u984F\u8272","sunColor"],["\u592A\u967D\uFF5C\u5149\u6688\u984F\u8272","bloomColor"],["\u592A\u967D\uFF5C\u5713\u76E4\u534A\u5F91\uFF08\u5EA6\uFF09","sunSize",.3,5,.05],["\u592A\u967D\uFF5C\u5713\u76E4\u4EAE\u5EA6","sunDisc",0,3,.01],["\u592A\u967D\uFF5C\u5149\u6838","sunCore",0,3,.01],["\u592A\u967D\uFF5C\u67D4\u5149 \u5F37\u5EA6","sunBloom",0,2,.01],["\u592A\u967D\uFF5C\u67D4\u5149 \u7BC4\u570D\uFF08\u5EA6\uFF09","sunBloomSize",3,45,.5],["\u9060\u5C71\uFF5C\u4E0D\u900F\u660E","rangeOpacity",0,1,.01],["\u9060\u5C71\uFF5C\u9AD8\u5EA6\uFF08\u5EA6\uFF09","rangeHeight",2,30,.1],["\u9060\u5C71\uFF5C\u5BEC\u5EA6\uFF08\u5EA6\uFF09","rangeWidth",12,120,.5],["\u9060\u5C71\uFF5C\u65B9\u4F4D\uFF08\u5EA6\uFF09","rangeAz",-40,40,.5],["\u9060\u5C71\uFF5C\u8CBC\u5730\u9AD8\u5EA6\uFF08\u5EA6\uFF09","rangeLift",-3,4,.05],["\u9060\u5C71\uFF5C\u9727\u5316","rangeHaze",0,1,.01],["\u9060\u5C71\uFF5C\u8272\u8ABF","rangeTint"],["\u9060\u5C71\uFF5C\u5C0D\u6BD4\uFF08\u5927\uFF1D\u5C71\u66F4\u6697\uFF09","rangeContrast",.6,2.6,.01],["\u9060\u5C71\uFF5C\u67D4\u7126","rangeSoft",0,4,.05],["\u6E56\u9762\uFF5C\u6DF1\u8655\u984F\u8272","deep"],["\u6E56\u9762\uFF5C\u53D7\u5149\u984F\u8272","lit"],["\u6E56\u9762\uFF5C\u6700\u6697\u984F\u8272","ink"],["\u6E56\u9762\uFF5C\u6CE1\u6CAB\uFF0F\u4EAE\u767D","foam"],["\u6E56\u9762\uFF5C\u6F23\u6F2A\u5927\u5C0F","waterScale",.3,3,.01],["\u6E56\u9762\uFF5C\u6F23\u6F2A\u901F\u5EA6","waterSpeed",0,4,.01],["\u6E56\u9762\uFF5C\u8D77\u4F0F\uFF08\u7C97\u7CD9\u5EA6\uFF09","waterRough",0,3,.01],["\u6E56\u9762\uFF5C\u6A6B\u5411\u62C9\u9577","waterStretch",1,6,.05],["\u6E56\u9762\uFF5C\u5929\u7A7A\u5012\u5F71 \u5F37\u5EA6","skyReflect",0,1.6,.01],["\u6E56\u9762\uFF5C\u83F2\u6D85\u8033 \u5E95\u503C","fresnelMin",0,.6,.005],["\u6E56\u9762\uFF5C\u83F2\u6D85\u8033 \u6307\u6578","fresnelPower",.8,8,.05],["\u6E56\u9762\uFF5C\u8FD1\u8655\u58D3\u6697","waterNearDark",0,1,.01],["\u9583\u9EDE\uFF5C\u984F\u8272","glintColor"],["\u9583\u9EDE\uFF5C\u5F37\u5EA6","glintStrength",0,4,.01],["\u9583\u9EDE\uFF5C\u5927\u5C0F\uFF08\u5927\uFF1D\u66F4\u67D4\u66F4\u5BEC\uFF09","glintSize",0,1,.01],["\u9583\u9EDE\uFF5C\u5149\u5E36\u5BEC\u5EA6\uFF08\u5EA6\uFF09","glintBand",3,60,.5],["\u9583\u9EDE\uFF5C\u96C6\u4E2D\u5728\u5149\u5E36","glintFocus",0,1,.01],["\u9583\u9EDE\uFF5C\u8D77\u4F0F\u653E\u5927","glintSpread",.5,4,.01],["\u9583\u9EDE\uFF5C\u9AD8\u5149\u6EFE\u964D","glintKnee",0,6,.05],["\u7B26\u865F\u5012\u5F71\uFF5C\u5F37\u5EA6","reflStrength",0,1.4,.01],["\u7B26\u865F\u5012\u5F71\uFF5C\u9577\u5EA6","reflLength",.1,4,.01],["\u7B26\u865F\u5012\u5F71\uFF5C\u6F23\u6F2A\u626D\u66F2","reflRipple",0,3,.01],["\u7B26\u865F\u5012\u5F71\uFF5C\u83F2\u6D85\u8033\uFF08\u8FD1\u6C34\u9762\u66F4\u6DE1\uFF09","reflFresnel",0,1,.01],["\u7B26\u865F\u5012\u5F71\uFF5C\u6A21\u7CCA","reflBlur",0,3,.01],["\u5FAE\u5875\uFF0F\u6C34\u6EF4\uFF5C\u6578\u91CF","moteCount",0,480,1],["\u5FAE\u5875\uFF0F\u6C34\u6EF4\uFF5C\u5927\u5C0F","moteSize",.2,3,.01],["\u5FAE\u5875\uFF0F\u6C34\u6EF4\uFF5C\u901F\u5EA6","moteSpeed",0,4,.01],["\u5FAE\u5875\uFF0F\u6C34\u6EF4\uFF5C\u4E0D\u900F\u660E","moteOpacity",0,1.5,.01],["\u5FAE\u5875\uFF0F\u6C34\u6EF4\uFF5C\u984F\u8272","moteColor"],["\u756B\u9762\uFF5C\u6697\u89D2","vignette",0,1.5,.01],["\u756B\u9762\uFF5C\u66DD\u5149","exposure",.4,1.8,.01],["\u756B\u9762\uFF5C\u8F38\u51FA\uFF081\uFF1D\u986F\u793A\u8272\uFF0C0\uFF1D\u7DDA\u6027\uFF09","outputDisplay",0,1,1],["\u93E1\u982D\uFF5C\u9AD8\u5EA6","camHeight",.1,1.5,.01],["\u93E1\u982D\uFF5C\u8996\u89D2\uFF08\u5EA6\uFF09","fov",18,70,.5],["\u93E1\u982D\uFF5C\u5730\u5E73\u7DDA\uFF08\u7531\u4E0A\uFF09","horizon",.35,.8,.005],["\u93E1\u982D\uFF5C\u63A8\u9032\u91CF\uFF080\u21921\uFF09","drift",0,.3,.005],["\u93E1\u982D\uFF5C\u5FAE\u6643","sway",0,1.5,.01],["\u5149\u7DDA\uFF5C\u96A8\u9032\u5EA6\u8B8A\u5316","qLight",0,2,.01],["\u77EE\u8996\u7A97\uFF5C\u7B26\u865F\u958B\u59CB\u8B93\u4F4D\u7684\u8996\u7A97\u9AD8\uFF08px\uFF09","shortFrom",500,1e3,10],["\u77EE\u8996\u7A97\uFF5C\u7B26\u865F\u8B93\u5230\u6700\u5C0F\u7684\u8996\u7A97\u9AD8\uFF08px\uFF09","shortTo",320,700,10],["\u77EE\u8996\u7A97\uFF5C\u7B26\u865F\u6700\u5C0F\u500D\u7387","shortSize",.5,1,.01],["\u7B26\u865F\uFF5C\u9AD8\u5EA6\uFF08\u4E2D\u5FC3\uFF0C\u7531\u4E0A\uFF09","markY",.15,.7,.005],["\u7B26\u865F\uFF5C\u5927\u5C0F\uFF08\u756B\u9762\u9AD8\u5EA6\u6BD4\uFF09","markSize",.1,.7,.005],["\u624B\u6A5F\uFF5C\u8996\u89D2\uFF08\u5EA6\uFF09","fovPortrait",30,90,.5],["\u624B\u6A5F\uFF5C\u5730\u5E73\u7DDA\uFF08\u7531\u4E0A\uFF09","portraitHorizon",.35,.8,.005],["\u624B\u6A5F\uFF5C\u7B26\u865F\u9AD8\u5EA6\uFF08\u7531\u4E0A\uFF09","portraitMarkY",.12,.7,.005],["\u624B\u6A5F\uFF5C\u7B26\u865F\u5927\u5C0F","portraitMarkSize",.1,.6,.005],["\u624B\u6A5F\uFF5C\u592A\u967D\u65B9\u4F4D\u6536\u650F\uFF081\uFF1D\u4E0D\u6536\uFF09","portraitSunShift",.2,1,.01],["\u73BB\u7483\u5149\uFF5C\u592A\u967D\u5149\u5F37\u5EA6","lightSun",0,6,.05],["\u73BB\u7483\u5149\uFF5C\u5929\u5149\u586B\u5145","lightFill",0,3,.01],["\u73BB\u7483\u5149\uFF5C\u74B0\u5883\u53CD\u5C04\u500D\u7387","envIntensity",0,4,.01],["\u5347\u8D77\uFF5C\u8D77\u59CB\u6C89\u5165\u6DF1\u5EA6\uFF08\u7B26\u865F\u9AD8\u5EA6\u500D\uFF09","riseSink",.6,2.5,.01],["\u5347\u8D77\uFF5C\u7DE9\u52D5\uFF080 \u7DDA\u6027\uFF0C1 \u5E73\u6ED1\uFF09","riseCurve",0,1,.01],["\u5347\u8D77\uFF5C\u6C34\u7DDA\u8DDF\u96A8\u5BE6\u969B\u5E95\u90E8\uFF081 \u958B\uFF09","riseTrueFoot",0,1,1],["\u5347\u8D77\uFF5C\u6F23\u6F2A\u74B0 \u5F37\u5EA6","ringAmp",0,3,.01],["\u5347\u8D77\uFF5C\u6F23\u6F2A\u74B0 \u9593\u8DDD\uFF08\u7B26\u865F\u9AD8\u5EA6\u500D\uFF09","ringSpacing",.08,1,.005],["\u5347\u8D77\uFF5C\u6F23\u6F2A\u74B0 \u64F4\u6563\u7BC4\u570D\uFF08\u7B26\u865F\u9AD8\u5EA6\u500D\uFF09","ringReach",.3,5,.01],["\u5347\u8D77\uFF5C\u6F23\u6F2A\u74B0 \u64F4\u6563\u901F\u5EA6","ringSpeed",0,3,.01],["\u5347\u8D77\uFF5C\u6F23\u6F2A\u74B0 \u8870\u6E1B\u6642\u9593\uFF08\u79D2\uFF09","ringDecay",.3,10,.05],["\u5347\u8D77\uFF5C\u6C34\u7DDA\u4EAE\u908A \u5F37\u5EA6","meniscus",0,3,.01],["\u5347\u8D77\uFF5C\u6C34\u7DDA\u4EAE\u908A \u5BEC\u5EA6\uFF08\u7B26\u865F\u9AD8\u5EA6\u500D\uFF09","meniscusWidth",.002,.06,.001],["\u5347\u8D77\uFF5C\u6C34\u7DDA\u67D4\u5149\u6688","cutGlow",0,3,.01],["\u5347\u8D77\uFF5C\u6C34\u9762\u88AB\u63A8\u958B","pushAmp",0,3,.01],["\u5916\u89C0\uFF5C\u51B0\u6E56\u767D\u665D\uFF081\uFF1D\u5957\u7528\uFF0C0\uFF1D\u9EC3\u660F\uFF09","glacierMode",0,1,1],["\u51B0\u4E18\uFF5C\u5F37\u5EA6\uFF08\u7A0B\u5E8F\u4F4E\u4E18\uFF09","hills",0,1,.01],["\u51B0\u4E18\uFF5C\u9AD8\u5EA6\uFF08\u5EA6\uFF09","hillHeight",.5,10,.05],["\u51B0\u4E18\uFF5C\u8D77\u4F0F\u5BC6\u5EA6","hillScale",.3,3,.01],["\u51B0\u4E18\uFF5C\u8868\u9762\u7D0B\u7406","hillSharp",0,2,.01],["\u51B0\u4E18\uFF5C\u96EA\u8272","hillSnow"],["\u51B0\u4E18\uFF5C\u85CD\u5F71\u8272","hillBlue"],["\u9060\u5C71\uFF5C\u5CA9\u8272\uFF08\u51B0\u85CD\u91CD\u65B0\u4E0A\u8272\uFF09","rangeRock"],["\u9060\u5C71\uFF5C\u91CD\u65B0\u4E0A\u8272 \u6BD4\u4F8B","rangeRockMix",0,1,.01],["\u96F2\u7D72\uFF5C\u91CF","cloudAmount",0,1,.01],["\u96F2\u7D72\uFF5C\u5927\u5C0F","cloudScale",.3,3,.01],["\u96F2\u7D72\uFF5C\u901F\u5EA6","cloudSpeed",0,4,.01],["\u96F2\u7D72\uFF5C\u984F\u8272","cloudColor"],["\u5730\u5E73\u7DDA\u67D4\u9727\uFF5C\u91CF","mistAmount",0,1,.01],["\u5730\u5E73\u7DDA\u67D4\u9727\uFF5C\u9AD8\u5EA6\uFF08\u5EA6\uFF09","mistHeight",.5,10,.05],["\u5730\u5E73\u7DDA\u67D4\u9727\uFF5C\u5BEC\u5EA6\uFF08\u5EA6\uFF09","mistWidth",5,90,.5],["\u6E56\u9762\uFF5C\u7D30\u5FAE\u6F23\u6F2A\uFF08\u6700\u7D30\u5169\u5C64\uFF09","waterFine",0,2,.01],["\u6E56\u9762\uFF5C\u5012\u5F71\u67D3\u4E0A\u6C34\u8272","waterTint",0,1,.01],["\u7B26\u865F\u5012\u5F71\uFF5C\u6C34\u5E73\u626D\u52D5","reflWobble",0,3,.01],["\u85CD\u5149\u9EDE\uFF5C\u6578\u91CF","sparkCount",0,3,1],["\u85CD\u5149\u9EDE\uFF5C\u5927\u5C0F","sparkSize",.3,3,.01],["\u85CD\u5149\u9EDE\uFF5C\u9583\u720D\u901F\u5EA6","sparkSpeed",0,4,.01],["\u85CD\u5149\u9EDE\uFF5C\u984F\u8272","sparkColor"]],LAKE_PRESETS={dusk:{},glacier:{skyTop:"#86acd0",skyMid:"#aec8de",skyHorizon:"#dfe7ee",skyHaze:"#eceff2",skyMidEl:10,skyTopEl:48,skyCurve:.8,hazeHeight:4.5,hazeAmount:.6,sunAz:-28,sunEl:36,sunColor:"#fff0da",bloomColor:"#fff3e4",sunSize:2.6,sunDisc:0,sunBloom:.2,sunBloomSize:24,sunCore:.05,rangeOpacity:0,hills:1,hillHeight:6.4,hillScale:1,hillSharp:.55,hillSnow:"#eef3fc",hillBlue:"#5d82dc",rangeRock:"#7592dc",rangeRockMix:1,deep:"#c3d5e8",lit:"#e9f0f7",ink:"#a9c2dc",foam:"#ffffff",waterScale:1.4,waterSpeed:.5,waterRough:.26,waterStretch:3.4,waterFine:.45,waterTint:.06,skyReflect:1.04,fresnelMin:.46,fresnelPower:1.7,waterNearDark:.05,glintColor:"#fff4e2",glintStrength:.1,glintBand:30,glintFocus:.6,reflStrength:1,reflLength:1.6,reflRipple:2.3,reflFresnel:.08,reflBlur:1.25,reflWobble:1.1,moteCount:34,moteSize:1,moteOpacity:.5,moteColor:"#ffffff",cloudAmount:.55,cloudScale:1.8,cloudSpeed:.6,cloudColor:"#ffffff",mistAmount:.5,mistHeight:2.4,mistWidth:30,sparkCount:2,sparkSize:1,sparkSpeed:1,sparkColor:"#6fa4ff",vignette:.08,exposure:1.02,qLight:.4,lightSun:.9,lightFill:1.1,envIntensity:1.25}};const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),lerp=(a,b,t)=>a+(b-a)*t,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)},RAD=Math.PI/180,HEX=/^#[0-9a-f]{6}$/i,COLOR_KEYS=["skyTop","skyMid","skyHorizon","skyHaze","sunColor","bloomColor","rangeTint","deep","lit","ink","foam","glintColor","moteColor","hillSnow","hillBlue","rangeRock","cloudColor","sparkColor"],ENV_KEYS=new Set(["matchOpening","skyTop","skyMid","skyHorizon","skyHaze","skyMidEl","skyTopEl","skyCurve","hazeHeight","hazeAmount","sunAz","sunEl","sunColor","bloomColor","sunSize","sunDisc","sunBloom","sunBloomSize","sunCore","rangeOpacity","rangeHeight","rangeWidth","rangeAz","rangeLift","rangeHaze","rangeTint","rangeContrast","deep","lit","ink","skyReflect","fresnelMin","fresnelPower","hills","hillHeight","hillScale","hillSharp","hillSnow","hillBlue","rangeRock","rangeRockMix","cloudAmount","cloudScale","cloudColor","mistAmount","mistHeight","mistWidth","waterTint"]),STATIC_TIME=41.7,MARK_DIST=14,SKY_GLSL=`
#define PI 3.14159265359
#define TAU 6.28318530718
#ifndef LAKE_BACKDROP_DETAIL
#define LAKE_BACKDROP_DETAIL 0
#endif
uniform vec3 uTop, uMid, uHorizon, uHaze;
uniform vec4 uSkyA;        // mid elevation (rad), curve, top elevation (rad), haze height (rad)
uniform vec4 uSkyB;        // haze amount, ...
uniform vec4 uOpeningSun; // core, spread, strength, horizon glow \u2014 opening's actual dawn
uniform vec3 uSunDir, uSunCol, uBloomCol;
uniform vec4 uSunA;        // disc radius (rad), disc strength, bloom strength, bloom e-fold radius (rad)
uniform vec4 uSunB;        // core strength, hdr boost (1 for the picture), ...
uniform sampler2D uRangeTex;
uniform vec4 uRangeA;      // opacity, haze, tan(half width), azimuth (rad)
uniform vec4 uRangeB;      // base elevation (rad), height (rad), blur bias, contrast
uniform vec3 uRangeTint;
uniform float uTime;
uniform vec4 uCloud;       // amount, scale, speed
uniform vec3 uCloudCol;
uniform vec4 uHillsA;      // strength, height (rad), scale, surface texture
uniform vec3 uHillSnow, uHillBlue, uRangeRock;
uniform vec4 uRangeC;      // x: how much of the range is recoloured rock-blue \u2192 snow
uniform vec4 uMist;        // amount, height (rad), width (rad)
const vec3 RANGE_HAZE = vec3(.6062, .6941, .7972);
float lum3(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
float h11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vn1(float x) { float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h11(i), h11(i + 1.), f); }
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
vec3 lakeSky(vec3 d, float blurBias) {
  float el = asin(clamp(d.y, -1., 1.));
  float e = max(el, 0.);
  float t1 = pow(smoothstep(0., uSkyA.x, e), uSkyA.y);
  float t2 = smoothstep(uSkyA.x * .55, uSkyA.z, e);
  vec3 c = mix(mix(uHorizon, uMid, t1), uTop, t2);
  if (uSkyB.y > .5) {
    // Same elevation stops as the opening's montisEnv(): the visible upper
    // sky reaches deep blue at 17.5 degrees, rather than staying grey to 50.
    float b = clamp(blurBias * .025, 0., 1.);
    c = mix(uHorizon, uTop, smoothstep(.03, .30 + b * .20, d.y));
    c = mix(c, uMid, smoothstep(.34, .62 + b * .22, d.y));
    c = mix(c, uTop, smoothstep(.62, .96, d.y));
    float az = atan(d.x,d.z);
    c *= 1. + .07*cos(az*2.+.7) + .035*cos(az*3.-1.9);
  } else c = mix(c, uHaze, clamp(uSkyB.x * exp(-e / uSkyA.w), 0., 1.));
  float rangeSunMask = 1.;
  /* wisps of high cloud: streaks stretched along the horizon, thinning toward the zenith and the horizon */
  if (uCloud.x > 0.) {
    float cy = max(d.y, .03);
    vec2 cp = d.xz / (cy + .16);
    cp = vec2(cp.x * .32, cp.y * 1.7) * uCloud.y + vec2(uTime * .006 * uCloud.z, uTime * .0015 * uCloud.z);
    float cn = vn2(cp) * .5 + vn2(cp * 2.07 + 7.1) * .3 + vn2(cp * 4.3 + 3.7) * .2;
    float cv = smoothstep(.5 - .22 * uCloud.x, .82, cn) * smoothstep(.02, .14, d.y) * (1. - .75 * smoothstep(.45, .95, d.y));
    c = mix(c, uCloudCol, cv * .62 * uCloud.x);
  }
  /* the range: the opening's own band (colour in the top half, alpha in the bottom half of an opaque atlas) */
  if (uRangeA.x > 0.) {
    float rAz = atan(d.x, -d.z) - uRangeA.w;
    float rV = (el - uRangeB.x) / uRangeB.y;
    if (rV > 0. && rV < 1. && abs(rAz) < 1.4) {
      float rU = .5 + .5 * tan(rAz) / uRangeA.z;
      if (rU > 0. && rU < 1.) {
        /* explicit LOD: a mip chosen by the screen's own density (uRangeB.z) plus the softness dial; implicit derivatives
           would be undefined at the band's edges and along the rippled water */
        float rRow = (1. - rV) * .484375, lod = uRangeB.z + blurBias;
        vec3 rTex = pow(textureLod(uRangeTex, vec2(rU, 1. - rRow), lod).rgb, vec3(2.2));
        float rA = textureLod(uRangeTex, vec2(rU, .484375 - rRow), lod).r;
        rangeSunMask = 1. - rA * uRangeA.x;
        vec3 rc = rTex * (uRangeTint / RANGE_HAZE);                      // the atlas's pale haze becomes the dusk tint
        if (uRangeC.x > 0.) {                                            // glacier: dark rock \u2192 periwinkle shade, light \u2192 snow
          float rl = clamp(lum3(rTex) / lum3(RANGE_HAZE), 0., 1.);
          rc = mix(rc, mix(uRangeRock, uRangeTint, smoothstep(.3, .95, rl)), uRangeC.x);
        }
        rc *= pow(clamp(lum3(rc) / lum3(uRangeTint), 0., 1.), uRangeB.w - 1.);
#if LAKE_BACKDROP_DETAIL
        if (uSkyB.y < .5) {
          // Retain the atlas's actual illuminated faces. The old uniform
          // tint flattened the range into a single dark silhouette.
          float relief = clamp(lum3(rTex) / lum3(RANGE_HAZE), 0., 1.);
          float face = smoothstep(.20, .84, relief);
          float shoulder = smoothstep(.04, .32, rV);
          rc *= mix(1., mix(.84, 1.38, face), rA);
          rc += mix(uHaze, uSunCol, .10) * face * shoulder * .038 * rA;
        }
#endif
        rc += (c - uRangeTint) * (1. - rA);
        if (uSkyB.y > .5) rc = rTex + (c - RANGE_HAZE) * (1. - rA);
        rc = mix(rc, c, uRangeA.y * (1. - .45 * rV) * rA);               // aerial perspective
        c = mix(c, rc, uRangeA.x);
      }
    }
  }
  /* low snow hills (procedural): rolling blue shade under a pale crest, melting into the haze at their foot */
  if (uHillsA.x > 0.) {
    float haz = atan(d.x, -d.z);
    float hx = haz * uHillsA.z * 7.;
    float prof = .5 * vn1(hx * 1.1 + 2.3) + .28 * vn1(hx * 2.9 + 8.1) + .14 * vn1(hx * 7.3 + 1.7) + .08 * vn1(hx * 15. + 5.);
    float bumpR = (haz - .62) / .34, bumpL = (haz + .78) / .4, dip = (haz - .02) / .22;
    prof += .8 * exp(-bumpR * bumpR) + .42 * exp(-bumpL * bumpL) - .3 * exp(-dip * dip);
    float hh = max(prof, 0.) * uHillsA.y;
    float inside = 1. - smoothstep(hh - .0008, hh + .0006, el);
    if (inside > 0.) {
      float t = clamp(el / max(hh, 1e-4), 0., 1.);
      float det = vn2(vec2(haz * 70., el * 480.)) * .5 + vn2(vec2(haz * 160., el * 900.)) * .25;
      float lit = smoothstep(.22, 1.18, t + (det - .4) * uHillsA.w + .22 * (vn1(hx * 4. + 11.) - .5));
      vec3 hc = mix(uHillBlue, uHillSnow, lit);
      hc = mix(hc, uHaze, .45 * exp(-el / .006));
      c = mix(c, hc, inside * uHillsA.x);
    }
  }
  /* a soft mist on the horizon behind the mark */
  if (uMist.x > 0.) {
    float maz = atan(d.x, -d.z) / uMist.z, mh = e / uMist.y;
    float drift = vn2(vec2(atan(d.x, -d.z) * 9. + uTime * .013, e * 95. - uTime * .007));
    float wisps = smoothstep(.28, .72, drift);
    c = mix(c, uHaze, clamp(uMist.x * exp(-mh * mh) * exp(-maz * maz) * (.35 + .65 * wisps), 0., 1.) * .9);
  }
#if LAKE_BACKDROP_DETAIL
  if (uSkyB.y < .5) {
    // A low, broken veil reveals depth at the lake/range seam. It shares
    // the existing mist colour and remains still in reduced-motion mode.
    float az = atan(d.x, -d.z);
    float strata = .55 + .45 * vn2(vec2(az * 10. - uTime * .004, e * 115.));
    float lowAir = exp(-pow((e - .012) / .022, 2.));
    c = mix(c, uHaze, lowAir * strata * uMist.x * .20);
    // The horizon picks up the approved sun's colour and direction; no
    // second decorative sun, no change to the user's solar coordinates.
    vec2 sunH = normalize(uSunDir.xz + vec2(1e-5));
    vec2 dirH = d.xz / max(length(d.xz), 1e-4);
    float twilight = pow(max(dot(sunH, dirH), 0.), 9.) * exp(-pow(e / .035, 2.));
    c += uBloomCol * twilight * .020 * smoothstep(-.10, .12, uSunDir.y);
  }
#endif
  /* the sun: a tight glow, a small soft disc, a wide warm bloom that lifts and greys the blue around it */
  if (uSkyB.y > .5) {
    float k=max(dot(d,uSunDir),0.), b=clamp(blurBias*.025,0.,1.), sharp=1./(1.+b*7.);
    float g=uOpeningSun.x*pow(k,1400.*sharp)+.30*uOpeningSun.y*pow(k,150.*sharp)
      +.115*uOpeningSun.y*pow(k,16.)+.030*uOpeningSun.y*pow(k,3.);
    vec2 sunH=normalize(uSunDir.xz+vec2(1e-5)), dirH=d.xz/max(length(d.xz),1e-4);
    float gold=uOpeningSun.w*pow(max(dot(dirH,sunH),0.),5.)*exp(-abs(d.y)*9.);
    float solar=.62*pow(k,18000.*sharp);
    c += uSunCol*uOpeningSun.z*((g+uSunA.y*solar)*rangeSunMask+gold)*smoothstep(-.04,.015,uSunDir.y)*uSunB.y;
  } else {
  float a = acos(clamp(dot(d, uSunDir), -1., 1.));
  // Sunset stays near the horizon; a broad exponential veil used to wash
  // the entire navy sky brown, including the far side of the frame.
  float bloom = exp(-pow(a / uSunA.w, 2.));
  float veil = exp(-pow(a / (uSunA.w * 1.45), 2.)) * exp(-abs(el) * 14.);
  float core = 1. / (1. + pow(a / (uSunA.x * 2.4), 2.)); core *= core;
  float dk = a / (uSunA.x * .85), disc = exp(-dk * dk);
  float hdr = uSunB.y;
  c += uBloomCol * uSunA.z * (.75 * bloom + .5 * veil) * (1. + (hdr - 1.) * .25);
  c += uSunCol * (uSunB.x * core * 1.1 + uSunA.y * disc * 2.4) * hdr;
  }
  return c;
}
vec3 toSRGB(vec3 c) { c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
`,WATER_GLSL=(OCT,LAYERS)=>`
uniform float uPix, uCamH, uMirror, uSwell;
uniform vec4 uWater;        // ripple scale, stretch, speed, roughness
uniform vec3 uDeep, uLit, uInk, uFoam;
uniform vec4 uFres;         // base, power, sky reflection, near darkening
uniform vec4 uGlintA;       // strength, exponent, band half width (rad), band focus
uniform vec4 uGlintB;       // knee, spread
uniform vec3 uGlintCol;
uniform mat4 uMirrorMat;
uniform sampler2D uMirrorColor;     // premultiplied reflection of the mark (rgb\xB7coverage, coverage), with mips
uniform vec4 uRefl;         // strength, length, ripple, blur
uniform vec4 uRefl2;        // fresnel mix, waterline of the mark (y), mark height, mark distance
uniform vec4 uWaterB;       // finest ripples, reflection wobble, reflection tint
uniform vec4 uRing;         // ring slope amplitude, wave number, phase, reach
uniform vec4 uRing2;        // meniscus strength, meniscus width, push, on
uniform vec4 uFootInfo;     // half span, plane z, texel, glow around the meniscus
uniform sampler2D uFoot;    // distance (world units) from each x on the waterline to the mark's footprint
uniform vec4 uPointerRipples[3]; // ground XZ, birth time, slope strength; fixed-size impulse pool
vec2 ghash(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1. + 2. * fract(sin(p) * 43758.5453123); }
/* gradient noise + analytic derivative (value, d/dx, d/dy) */
vec3 gnoised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.), du = 30. * f * f * (f * (f - 2.) + 1.);
  vec2 ga = ghash(i), gb = ghash(i + vec2(1., 0.)), gc = ghash(i + vec2(0., 1.)), gd = ghash(i + vec2(1., 1.));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1., 0.)), vc = dot(gc, f - vec2(0., 1.)), vd = dot(gd, f - vec2(1., 1.));
  return vec3(va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd),
              ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * (va - vb - vc + vd) + vec2(vb, vc) - va));
}
const float SIG[4] = float[4](.065, .030, .014, .006);
/* Three crossing swells displace the surface itself, instead of only scrolling normals.
   Their analytic slopes keep the highlights attached to the moving crests. */
vec3 lakeSwell(vec2 p) {
  float tm = uTime * uWater.z;
  float a = 2.1 * p.y + 1.12 * p.x - tm * .65;
  float b = .94 * p.y - 1.8 * p.x + tm * .43;
  float c = 4.2 * p.y + 2.3 * p.x - tm * .90;
  return uSwell * vec3(sin(a) + .45 * sin(b) + .20 * sin(c),
    1.12 * cos(a) - .81 * cos(b) + .46 * cos(c),
    2.1 * cos(a) + .423 * cos(b) + .84 * cos(c));
}
/* slope (d/dx, d/dz) of the surface at a world xz; t = ray length (sets which octaves one pixel can still resolve) */
vec2 waterSlope(vec2 p, float t, out float swellV) {
  float fp = t * t * uPix / max(uCamH, .02);        // ground footprint of one pixel, along the view
  vec2 s = vec2(0.); swellV = 0.;
  for (int i = 0; i < ${OCT}; i++) {
    float fi = float(i);
    float f = .16 * pow(2.2, fi) * uWater.x;
    float lod = smoothstep(fp * 2., fp * 8., 1. / f);
    if (lod <= 0.) continue;
    float ang = .6 + 1.7 * fi;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 q = vec2(p.x / uWater.y, p.y) * f;
    float tt = uTime * uWater.z * (.05 + .028 * fi);
    vec3 n = vec3(0.);
    for (int l = 0; l < ${LAYERS}; l++) {
      float sg = l == 0 ? 1. : -.8;
      n += gnoised(q + dir * tt * sg + 7.31 * fi + float(l) * 13.7);
    }
    n /= float(${LAYERS});
    s += SIG[i] * (i >= 2 ? uWaterB.x : 1.) * lod * vec2(n.y / uWater.y, n.z);
    if (i == 1) swellV = n.x;
  }
  // Short crossing wavelets break the long swells into small moving facets.
  // Pixel-footprint filtering keeps distant water from sparkling or moir\xE9.
  for (int j = 0; j < ${OCT}; j++) {
    float fj = float(j), k = (3.2 + fj * fj * 2.1) * uWater.x;
    vec2 dir = vec2(sin(.7 + fj * 1.37), cos(.7 + fj * 1.37));
    float fade = 1. - smoothstep(.4, 1.4, fp * k);
    float phase = dot(p, dir) * k - uTime * uWater.z * sqrt(k) * .8;
    vec3 warp = gnoised(p * .8 + vec2(fj * 17.3, uTime * .025));
    s += (dir * k + warp.yz * 1.44) * cos(phase + warp.x * 1.8)
      * (.048 / k) * fade * uWaterB.x;
  }
  return s;
}
/* where the mark crosses the water: rings spreading out of its footprint, a thin bright meniscus, a soft push of the surface */
vec2 ringSlope(vec3 P, float fp, float px, out float men) {
  men = 0.;
  if (uRing2.w < .5) return vec2(0.);
  float xr = uFootInfo.x;
  float u = clamp(P.x / (2. * xr) + .5, 0., 1.), h = uFootInfo.z;
  float dxu = texture2D(uFoot, vec2(u, .5)).r + max(abs(P.x) - xr, 0.);
  float dxa = texture2D(uFoot, vec2(min(u + h, 1.), .5)).r, dxb = texture2D(uFoot, vec2(max(u - h, 0.), .5)).r;
  float dz = P.z - uFootInfo.y;
  float r = length(vec2(dxu, dz));
  if (r > uRing.w * 3.5 + 2.) return vec2(0.);
  vec2 dir = vec2(sign(dxa - dxb) * dxu, dz) / max(r, 1e-3);
  float w = max(uRing2.y, 1e-3);
  float ring = uRing.x * exp(-r / uRing.w) * cos(uRing.y * r - uRing.z) * smoothstep(0., w * 8., r);
  float push = uRing2.z * (r / uRing.w) * exp(-r * 1.4 / uRing.w);
  /* the meniscus lies along the front edge of the cut; seen this low the water is foreshortened ~200\xD7, so it is never
     drawn thinner than about two pixels (along the view and across) */
  float wx = max(w, 2.5 * px), wz = max(w, 2. * fp), dzm = dz - .07 * xr;
  float mm = exp(-(dxu * dxu) / (wx * wx) - (dzm * dzm) / (wz * wz));
  men = uRing2.x * (mm + uFootInfo.w * .35 * exp(-(dxu * dxu) / (wx * wx * 25.) - (dzm * dzm) / (wz * wz * 36.)));
  return dir * (ring + push);
}
/* Three damped surface impulses: optical normals only, no extra draw/texture pass.
   Pixel-footprint filtering keeps the expanding crests quiet at the horizon. */
vec2 pointerWaterSlope(vec2 p, float footprint) {
  vec2 slope = vec2(0.);
  for (int i = 0; i < 3; i++) {
    vec4 hit = uPointerRipples[i];
    float age = uTime - hit.z;
    if (hit.w <= 0. || age < 0. || age > 3.2) continue;
    vec2 delta = p - hit.xy;
    float radius = length(delta), front = radius - age * 1.15;
    float width = .32 + age * .075, k = 10.;
    float envelope = exp(-front * front / (width * width));
    float fade = smoothstep(.015, .13, age) * (1. - smoothstep(2., 3.2, age)) * exp(-age * .9);
    fade *= 1. - smoothstep(.22, .65, footprint * k);
    float derivative = k * cos(front * k) - 2. * front / (width * width) * sin(front * k);
    slope += delta / max(radius, .02) * derivative * envelope * fade * hit.w;
  }
  return slope;
}
vec3 lakeWater(vec3 d) {
  float t = -cameraPosition.y / min(d.y, -1e-5);
  vec3 P = cameraPosition + d * t;
  float swellFade = 1. - smoothstep(4., 18., t);
  for (int i = 0; i < 2; i++) {
    float height = lakeSwell(P.xz).x * swellFade;
    t = mix(t, (height - cameraPosition.y) / min(d.y, -1e-5), .5);
    P = cameraPosition + d * t;
  }
  float swellV;
  vec3 swell = lakeSwell(P.xz);
  vec2 s = waterSlope(P.xz, t, swellV) * uWater.w;
  /* far water is calm: the tilt that changes the reflected height (along the view) dies away first, so the mountains
     are mirrored in long soft strokes, never in thin hard lines */
  s *= vec2(mix(1., .55, smoothstep(8., 60., t)), mix(1., .12, smoothstep(5., 36., t)));
  // Keep the optical slope close to the actual displacement; excessive
  // amplification turns the troughs into broad parallel reflection bands.
  s += swell.yz * swellFade * 1.15;
  float men;
  vec2 rs = ringSlope(P, t * t * uPix / max(uCamH, .02), t * uPix, men);
  s += rs + pointerWaterSlope(P.xz, t * t * uPix / max(uCamH, .02));
  vec3 N = normalize(vec3(-s.x, 1., -s.y));
  float cosT = clamp(dot(N, -d), 0., 1.);
  float F = clamp((uFres.x + (1. - uFres.x) * pow(1. - cosT, uFres.y)) * uFres.z, 0., 1.);
  vec3 R = reflect(d, N);
  float reflectionVisibility = smoothstep(-.04, .025, R.y);
  R.y = max(R.y, .001);
  vec3 sky = lakeSky(normalize(R), 3.2) * mix(vec3(1.), uDeep * 2.4, uWaterB.z);   // the water takes a little of its own colour out of what it mirrors
  // Broad cool sky illumination is reflected by each wave facet. It gives
  // crests a silver edge while leaving the water body deep navy.
  sky += vec3(.055,.095,.14) * pow(max(dot(normalize(R), normalize(vec3(.30,.20,-.94))),0.),48.);
  /* the body of the water: ink \u2192 deep with the swell, lit where a facet turns toward the sun, darker near the camera */
  vec2 sx = normalize(uSunDir.xz + vec2(1e-5));
  float facing = dot(-s, sx);
  vec3 body = mix(uInk, uDeep, smoothstep(-.45, .45, swellV));
  body = mix(body, uLit, smoothstep(-.01, .08, facing) * .6);
  body *= 1. - uFres.w * exp(-t / (uCamH * 6.));
  vec3 col = mix(body, sky, F * reflectionVisibility);
  /* sun glitter: a soft lobe on slightly exaggerated facets, kept in a band under the sun, rolled off */
  vec3 Ng = normalize(vec3(-s.x * uGlintB.y, 1., -s.y * uGlintB.y));
  vec3 Rg = reflect(d, Ng);
  float glintVisibility = smoothstep(-.04, .025, Rg.y);
  Rg = normalize(vec3(Rg.x, max(Rg.y, .001), Rg.z));
  float lobe = pow(max(dot(Rg, uSunDir), 0.), uGlintA.y);
  float az = atan(d.x, -d.z) - atan(uSunDir.x, -uSunDir.z);
  az -= TAU * floor((az + PI) / TAU);  az -= TAU * step(PI, az);
  float aw = az / uGlintA.z;
  float band = exp(-aw * aw);
  float g = uGlintA.x * lobe * mix(1., band, uGlintA.w) * glintVisibility;
  g = g / (1. + g * uGlintB.x);
  col += uGlintCol * g;
  /* the mark: the mirrored render, converted to premultiplied colour + coverage (mip-mapped), read at a mip that
     grows with the height of the reflected point: sharp at the foot, soft as it fades */
  if (uRefl.x > 0.) {
    vec4 mq = uMirrorMat * vec4(P.x, 0., P.z, 1.);
    float dz = max(cameraPosition.z - P.z, .05);
    float yR = uCamH * (uRefl2.w / dz - 1.);                       // height of the reflected ray at the mark's depth
    float up = max(yR - uRefl2.y, 0.) / max(uRefl2.z, 1e-3);       // heights above the waterline, in mark heights
    vec2 muv = mq.xy / mq.w + s * uRefl.z * .22;
    muv.x += uWaterB.y * (.35 + min(up, 1.6)) * (sin(muv.y * 150. + uTime * 1.2 + s.y * 25.) * .0032 + s.x * .05);   // the edges of the mirror image shiver sideways
    float fade = exp(-up / max(uRefl.y, .05));
    float lodm = log2(1. + (1.2 + 13. * smoothstep(0., 1.6, up)) * uRefl.w);
    vec4 mk = textureLod(uMirrorColor, muv, lodm);
    vec3 mc = mk.rgb / max(mk.a, 1e-3);
    float fw = mix(1., clamp(F * 1.7, 0., 1.), uRefl2.x);
    col = mix(col, mc * mix(vec3(1.), uLit * 1.6, .12), clamp(mk.a * uRefl.x * fade * fw, 0., 1.));
  }
  float rsh = clamp(rs.y * 11., -1., 1.);                          // the rings catch the light: crests brighter, troughs darker
  col *= 1. + .26 * rsh;
  col += uFoam * max(rsh, 0.) * .07;
  col += uFoam * clamp(men, 0., 1.6) * .8;                         // the meniscus: a thin bright line where the water climbs the glass
  float horizonFog = smoothstep(35., 280., t) * .3;
  col = mix(col, lakeSky(normalize(vec3(d.x, .002, d.z)), 3.), horizonFog);
  return col;
}
`,BACKDROP_VERTEX=`
varying vec3 vRay;
void main() {
  vec4 far = inverse(projectionMatrix) * vec4(position.xy, 1., 1.);
  vRay = transpose(mat3(viewMatrix)) * (far.xyz / far.w);
  gl_Position = vec4(position.xy, 1., 1.);
}
`,BACKDROP_FRAGMENT=(oct,layers)=>`
#define LAKE_BACKDROP_DETAIL 1
${SKY_GLSL}
${WATER_GLSL(oct,layers)}
varying vec3 vRay;
uniform vec2 uRes;
uniform vec4 uOut;          // exposure, vignette, output display (1) / linear (0)
uniform vec2 uOpeningVeil;
uniform float uSkySpecks;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec3 d = normalize(vRay);
  vec3 col;
  if (uMirror > .5) col = lakeSky(normalize(vec3(d.x, max(d.y, 0.), d.z)), 0.);
  else if (d.y >= 0.) col = lakeSky(d, 0.);
  else col = lakeWater(d);
  if (d.y > .025 && uMirror < .5 && uSkySpecks > 0.) {
    // Angular coordinates attach fine distant specks to the world, not the HUD.
    vec2 cell = vec2(atan(d.x, -d.z), asin(d.y)) * vec2(175., 280.);
    vec2 id = floor(cell), local = fract(cell) - .5;
    float seed = hash12(id + 71.3), occupied = step(1. - .05 * uSkySpecks, seed);
    vec2 offset = vec2(hash12(id + 2.7), hash12(id + 8.1)) * .6 - .3;
    float aa = max(length(fwidth(cell)) * .45, .035);
    float point = 1. - smoothstep(.025, .025 + aa, length(local - offset));
    float shimmer = .82 + .18 * sin(uTime * .35 + seed * 180.);
    col += vec3(.38,.62,.82) * point * occupied * shimmer
      * smoothstep(.025,.10,d.y) * (.04 + .19 * hash12(id + 19.));
  }
  // Same sun-centred, cool shadow grade as the opening; never bake it into IBL.
  if (uSkyB.y > .5 && uMirror < .5) {
    vec3 v = (viewMatrix * vec4(d, 0.)).xyz;
    vec3 l = (viewMatrix * vec4(uSunDir, 0.)).xyz;
    vec2 delta = (v.xy / max(-v.z, 1e-4) - l.xy / max(-l.z, 1e-4)) / vec2(1.26, 1.90);
    float k = 1. - (1. - uOpeningVeil.x) * smoothstep(.28, 1.40, length(delta) / max(uOpeningVeil.y, 1e-4));
    col *= mix(vec3(.48, .56, .74), vec3(1.), k);
  }
  col *= uOut.x;
  /* a soft shoulder: nothing reaches pure white, the sun's heart stays a warm cream */
  vec3 over = max(col - .72, 0.);
  col = min(col, vec3(.72)) + .28 * (1. - exp(-over / .28));
  vec2 uv = gl_FragCoord.xy / uRes;
  if (uSkyB.y > .5 && uMirror < .5) col *= 1. - .12 * smoothstep(.74, 1., uv.y);
  col *= 1. - uOut.y * (1. - uMirror) * smoothstep(.36, 1.02, length((uv - .5) * vec2(uRes.x / uRes.y * .62, 1.)));
  if (uOut.z > .5) col = toSRGB(col);
  col += (hash12(gl_FragCoord.xy) - .5) / 255.;
  gl_FragColor = vec4(col, 1.);
}
`,ENV_VERTEX=`
varying vec3 vRay;
void main() { vRay = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`,ENV_FRAGMENT=`
${SKY_GLSL}
uniform vec3 uDeep, uLit, uInk, uGlintCol;
uniform vec4 uFres;
varying vec3 vRay;
void main() {
  vec3 d = normalize(vRay);
  vec3 col;
  if (d.y >= 0.) col = lakeSky(d, 1.);
  else {
    vec3 R = vec3(d.x, -d.y, d.z);
    float F = clamp((uFres.x + (1. - uFres.x) * pow(1. - clamp(-d.y, 0., 1.), uFres.y)) * uFres.z, 0., 1.);
    vec3 body = mix(uInk, uDeep, .6) * (1. - .5 * smoothstep(.1, .9, -d.y));
    col = mix(body, lakeSky(R, 3.), F);
    col += uGlintCol * .35 * pow(max(dot(R, uSunDir), 0.), 60.);
  }
  // A cool reflection card, seen only by the glass environment.
  float softbox = pow(max(dot(d, normalize(vec3(.72,.28,.64))),0.),45.);
  col += vec3(.18,.38,.64) * softbox * 3.2;
  gl_FragColor = vec4(col, 1.);
}
`,MOTE_VERTEX=`
attribute vec4 aSeed;       // x: -1..1 across, y: 0..1 up, z: 0..1 depth, w: random
uniform float uTime, uSpeed, uSize, uResY, uCount;
uniform vec4 uView;         // tan(half fov), aspect, horizon ndc, camera height
uniform vec2 uDepth;
uniform float uSoft;
varying vec4 vSilk;      // streak in sprite coordinates (x, y), the speck's share of the sprite, 0
varying vec2 vKs;        // gaussian widths: core, halo
varying vec2 vAmps;      // their amplitudes (light is kept as they widen)
#ifdef LOGO_NEAR_SPECKS
uniform vec3 uMarkCenter, uMarkExtent;
uniform vec2 uOrbitClock, uOrbitShutter;
uniform vec4 uOrbitStyle; // randomness, radius, size, brightness
uniform vec2 uOrbitSpread; // density, wandering amplitude
uniform vec4 uOrbitPointer; // world XY, strength, influence radius
uniform float uMarkVisibility;
#endif
varying vec4 vInfo;
#ifdef LOGO_NEAR_SPECKS
// Vertical helix: X/Z orbit the mark's Y axis; Y only rises during each life.
// https://mathworld.wolfram.com/Helix.html (axes permuted for Three.js Y-up).
vec3 orbitAt(float seed, float t, float rise, float random, float scatter, out float life, out float plume, out float angle) {
  life = fract(aSeed.y + rise * mix(.078, .058 + seed * .04, random));
  plume = smoothstep(.66, 1., life);
  // Separate angular and upward clocks let either speed change without teleporting particles.
  angle = aSeed.y * 6.2831853 * 2.15
    + t * mix(.9, .68 + .42 * fract(seed * 17.3), random)
    + aSeed.x * (.22 + random * 2.1)
    + sin(t * .23 + seed * 31.) * random * (.22 + scatter * .2);
  float radius = (uMarkExtent.x + uMarkExtent.y * .13)
    * uOrbitStyle.y * (1. + (aSeed.z - .5) * (mix(.12, .42, random) + scatter * .34)
    + sin(t * .41 + seed * 23.) * random * (.07 + scatter * .09)) * (1. - .72 * plume);
  // A few motes first appear close to the lit solid, then join the rising orbit.
  float fromGlass = step(.72, fract(seed * 11.7));
  radius *= mix(1., mix(.6, 1., smoothstep(0., .18, life)), fromGlass);
  vec3 p = uMarkCenter;
  p.x += cos(angle) * radius;
  p.z += sin(angle) * radius;
  p.y += mix(-.98, 1.78, life) * uMarkExtent.y;
  // The stream loosens above the tip into a soft upward plume.
  p.x += sin(t * .8 + seed * 43.) * plume * uMarkExtent.y * .06;
  p.z += cos(t * .7 + seed * 31.) * plume * uMarkExtent.y * .06;
  // Soft wandering keeps a loose helix, with the widest movement around the mark.
  p.x += sin(t * .53 + seed * 61.) * scatter * uMarkExtent.y * .12;
  p.z += cos(t * .47 + seed * 47.) * scatter * uMarkExtent.y * .12;
  return p;
}
#endif
void main() {
  vSilk = vec4(0., 0., 1., 0.); vKs = vec2(27., 3.4); vAmps = vec2(1.);
#ifdef LOGO_NEAR_SPECKS
  if (aSeed.w > 1.) {
    float seed = aSeed.w - 2., t = uOrbitClock.x;
    if (fract(seed * 79.13) >= uOrbitSpread.x) {
      gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 1.; vInfo = vec4(0.); return;
    }
    float random = uOrbitStyle.x, scatter = uOrbitSpread.y;
    float life, plume, angle, lifeB, plumeB, angleB;
    vec3 p = orbitAt(seed, t, uOrbitClock.y, random, scatter, life, plume, angle);
    // Motion blur: where this speck was one shutter ago, along its own path. Between frames a fast speck would jump several pixels (strobing).
    vec3 pOwn = p, pB = orbitAt(seed, t - uOrbitShutter.x, uOrbitClock.y - uOrbitShutter.y, random, scatter, lifeB, plumeB, angleB);
    vec2 away = p.xy - uOrbitPointer.xy;
    float influence = (1. - smoothstep(0., max(.01, uOrbitPointer.w), length(away))) * uOrbitPointer.z;
    p.xy += normalize(away + vec2(.001, .002)) * influence * uMarkExtent.y * .32;
    p.z += sin(seed * 43.) * influence * uMarkExtent.y * .16;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    float screenY = .5 - .5 * gl_Position.y / gl_Position.w;
    float pulse = .5 + .5 * sin(t * 1.7 + seed * 29.);
    float depthLight = .65 + .35 * smoothstep(-.6, .75, sin(angle));
    float fade = smoothstep(0., .075, life) * (1. - smoothstep(.87, 1., life));
    fade *= smoothstep(.015, .065, screenY) * (1. - smoothstep(.71, .79, screenY));
    fade *= smoothstep(.03, .35, p.y);
    vInfo = vec4(0., uMarkVisibility * (.72 + .28 * pulse) * depthLight * fade * uOrbitStyle.w * (1. + influence * .18), 1., seed);
    float diameter = 6. + 10. * seed * seed + 16. * pow(seed, 14.);
    float perspective = clamp((-uMarkCenter.z) / max(1., -mv.z), .7, 1.4);
    float px = clamp(diameter * perspective * (.94 + .12 * pulse) * uResY / 950. * uOrbitStyle.z, 1., 64.);
    vec4 cNow = projectionMatrix * modelViewMatrix * vec4(pOwn, 1.), cWas = projectionMatrix * modelViewMatrix * vec4(pB, 1.);
    vec2 streak = (cNow.xy / cNow.w - cWas.xy / cWas.w) * .5 * vec2(uView.y, 1.) * uResY;   // device pixels
    if (abs(life - lifeB) > .5) streak = vec2(0.);                                           // the wrap of its life (invisible then)
    float len = length(streak), R2 = .25 * px * px, sft = max(uSoft, .001);
    // Band-limited, as in light-specks.js: the core never narrower than the pixel grid, its light nearly conserved, the sprite big enough for the tails.
    float sprite = (uSoft > .001 ? max(px, 11.) : px) + len;
    gl_PointSize = sprite;
    vKs = vec2(min(27., R2 / (1.3225 * sft * sft)), min(5.5, R2 / (5.76 * sft * sft)));
    float coreRadius = sqrt(R2 / vKs.x);
    vAmps = pow(vKs / vec2(27., 5.5), vec2(.8)) / (1. + len / (1.77 * max(coreRadius, .5)));  // spread along the streak
    vSilk = vec4(streak / sprite * 2., px / sprite, 0.);
    return;
  }
#endif
  float r = fract(aSeed.w * 7.13);
  float z = mix(uDepth.x, uDepth.y, pow(aSeed.z, 1.3));
  float t = uTime * uSpeed;
  float up = fract(aSeed.y + t * (.0035 + .006 * fract(aSeed.w * 3.7)));
  float ny = mix(uView.z - .05, 1.05, up);
  float nx = aSeed.x + sin(t * .2 + aSeed.w * 40.) * .03 + sin(t * .067 + aSeed.w * 11.) * .025;
  vec3 wp = vec3(nx * uView.x * uView.y * z, max(uView.w + uView.x * (ny - uView.z) * z, .06), -z);
  vec4 mv = modelViewMatrix * vec4(wp, 1.);
  float dia = uSize * (.012 + .05 * r * r);
  float px = dia * (uResY * .5) / (uView.x * z);
  float pc = clamp(px, 1., 56.), R2 = .25 * pc * pc, sft = max(uSoft, .001), sprite = uSoft > .001 ? max(pc, 7.) : pc;
  gl_PointSize = sprite;
  vKs = vec2(27., min(3.4, R2 / (1.69 * sft * sft))); vAmps = vec2(1., pow(vKs.y / 3.4, .8)); vSilk = vec4(0., 0., pc / sprite, 0.);
  gl_Position = projectionMatrix * mv;
  float kind = step(.72, r) * step(z, 12.) * step(5., px);
  float edge = smoothstep(0., .08, up) * smoothstep(1., .9, up);
  vInfo = vec4(kind, edge * smoothstep(1.2, 3.2, px) * smoothstep(1.8, 4., z) * (1. - .35 * smoothstep(14., 30., z)), 0., 0.);
}
`,MOTE_FRAGMENT=`
uniform vec3 uColor, uSkyTint;
uniform vec2 uSunV;
uniform float uOpacity, uDisplay;
varying vec4 vInfo, vSilk;
varying vec2 vKs, vAmps;
vec3 toSRGB(vec3 c) { c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main() {
  vec2 q = gl_PointCoord * 2. - 1.; q.y = -q.y;
  float e2 = dot(q, q);
  if (e2 > 1.) discard;
  float rim01 = 1. - smoothstep(.62, 1., e2);
  // the nearest point on the speck's streak, then the speck's own radius
  float ss = dot(vSilk.xy, vSilk.xy);
  vec2 c = (ss > 1e-7 ? q - vSilk.xy * clamp(dot(q, vSilk.xy) / ss, -.5, .5) : q) / vSilk.z;
  float r2 = dot(c, c);
#ifdef LOGO_NEAR_SPECKS
  if (vInfo.z > .5) {
    float core = exp(-r2 * vKs.x) * vAmps.x * rim01, halo = exp(-r2 * vKs.y) * vAmps.y * rim01;
    vec3 light = mix(vec3(.67, .84, 1.), vec3(1.), core);
    gl_FragColor = vec4(light, (core + halo * .38) * vInfo.y * .8);
    return;
  }
#endif
  vec3 col; float a;
  if (vInfo.x < .5) { a = exp(-r2 * vKs.y) * vAmps.y * .6 * rim01; col = uColor; }
  else {
    if (r2 > 1.) discard;
    vec3 n = vec3(c, sqrt(1. - r2));
    float rim = pow(1. - n.z, 2.2);
    vec3 h = normalize(vec3(uSunV, 1.) + vec3(0., 0., 1.));
    float spec = pow(max(dot(n, h), 0.), 40.);
    col = uSkyTint * (.12 + 1.5 * rim) + vec3(.02, .04, .08) * (1. - rim) + uColor * spec * 2.2;
    a = (.3 + .6 * rim + spec) * (1. - smoothstep(.8, 1., sqrt(r2)));
  }
  col = col / (1. + col * .6);
  if (uDisplay > .5) col = toSRGB(col);
  gl_FragColor = vec4(col, a * vInfo.y * uOpacity);
}
`,FOOT_FRAGMENT=`
uniform sampler2D tMark; uniform mat4 uMat; uniform vec4 uFootA;   // half span, plane z, lod, threshold
float cov(float x) { vec4 q = uMat * vec4(x, 0., uFootA.y, 1.); return textureLod(tMark, q.xy / q.w, uFootA.z).a; }
void main() {
  float x = (gl_FragCoord.x / 128. * 2. - 1.) * uFootA.x;
  float best = 99.;
  for (int j = 0; j < 128; j++) {
    float xj = ((float(j) + .5) / 128. * 2. - 1.) * uFootA.x;
    if (cov(xj) > uFootA.w) best = min(best, abs(x - xj));
  }
  gl_FragColor = vec4(best, 0., 0., 1.);
}
`,SPARK_VERTEX=`
attribute vec4 aSeed;       // x, y: view position (-1..1), z: phase, w: random
uniform float uTime, uSpeed, uSize, uResY;
uniform vec4 uView;         // tan(half fov), aspect, horizon ndc, camera height
varying float vB;
void main() {
  float z = 24.;
  vec3 wp = vec3(aSeed.x * uView.x * uView.y * z, uView.w + uView.x * (aSeed.y - uView.z) * z, -z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.);
  float t = uTime * uSpeed;
  float b = .5 + .5 * sin(t * .9 + aSeed.z * 6.2832); b = b * b * (3. - 2. * b);
  float flash = pow(max(0., sin(t * .23 + aSeed.w * 30.)), 6.);
  vB = .35 + .5 * b + .5 * flash;
  gl_PointSize = clamp(uSize * .5 * (uResY * .5) / (uView.x * z) * (.85 + .5 * vB), 2., 64.);
}
`,SPARK_FRAGMENT=`
uniform vec3 uColor; uniform float uOpacity, uDisplay;
varying float vB;
vec3 toSRGB(vec3 c) { c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main() {
  vec2 c = gl_PointCoord * 2. - 1.;
  float r2 = dot(c, c);
  if (r2 > 1.) discard;
  float core = exp(-r2 * 22.), halo = exp(-r2 * 4.5);
  vec3 col = uColor * (halo * .55 + core * 1.1) + vec3(.8, .9, 1.) * core * .9;
  float a = clamp((halo * .55 + core) * vB, 0., 1.) * uOpacity;
  col = col / (1. + col * .4);
  if (uDisplay > .5) col = toSRGB(col);
  gl_FragColor = vec4(col, a);
}
`;export function createLakeScene({THREE,renderer,width=1280,height=720,palette=null,assetBase=null,small=!1,mobilePerformance=!1,reducedMotion=!1}={}){let disposed=!1,W=Math.max(2,width|0),H=Math.max(2,height|0);const OCT=small?3:4,LAYERS=small?1:2,mirrorScale=mobilePerformance?.5:.75,L={...LAKE_DEFAULTS},paletteOv={};if(palette)for(const[k,to]of[["deep","deep"],["lit","lit"],["ink","ink"],["foam","foam"],["glint","glintColor"],["sun","sunColor"]])typeof palette[k]=="string"&&HEX.test(palette[k])&&(L[to]=palette[k],paletteOv[to]=palette[k]);const col=hex=>new THREE.Color(hex),v3=c=>new THREE.Vector3(c.r,c.g,c.b),scene=new THREE.Scene,camera=new THREE.PerspectiveCamera(L.fov,W/H,.5,3e3),markAnchor=new THREE.Group;markAnchor.name="markAnchor",scene.add(markAnchor);const sunLight=new THREE.DirectionalLight("#ffd8b0",L.lightSun);sunLight.name="lakeSun",scene.add(sunLight,sunLight.target);const fillLight=new THREE.HemisphereLight("#9fb4d8","#2d4a60",L.lightFill);fillLight.name="lakeFill",scene.add(fillLight);const U={uTop:{value:new THREE.Vector3},uMid:{value:new THREE.Vector3},uHorizon:{value:new THREE.Vector3},uHaze:{value:new THREE.Vector3},uSkyA:{value:new THREE.Vector4},uSkyB:{value:new THREE.Vector4},uSunDir:{value:new THREE.Vector3(0,0,-1)},uSunCol:{value:new THREE.Vector3},uBloomCol:{value:new THREE.Vector3},uSunA:{value:new THREE.Vector4},uSunB:{value:new THREE.Vector4(.6,1,0,0)},uOpeningSun:{value:new THREE.Vector4(.5,.6,.7846270657690746,.063631587245162)},uRangeTex:{value:null},uRangeA:{value:new THREE.Vector4},uRangeB:{value:new THREE.Vector4},uRangeTint:{value:new THREE.Vector3},uTime:{value:0},uPix:{value:7e-4},uCamH:{value:L.camHeight},uMirror:{value:0},uWater:{value:new THREE.Vector4},uSwell:{value:L.waterSwell},uDeep:{value:new THREE.Vector3},uLit:{value:new THREE.Vector3},uInk:{value:new THREE.Vector3},uFoam:{value:new THREE.Vector3},uFres:{value:new THREE.Vector4},uGlintA:{value:new THREE.Vector4},uGlintB:{value:new THREE.Vector4},uGlintCol:{value:new THREE.Vector3},uMirrorMat:{value:new THREE.Matrix4},uMirrorColor:{value:null},uRefl:{value:new THREE.Vector4},uRefl2:{value:new THREE.Vector4},uRes:{value:new THREE.Vector2(W,H)},uOut:{value:new THREE.Vector4(1,.45,1,0)},uOpeningVeil:{value:new THREE.Vector2(.14,Math.tan(36*.5*RAD))},uSkySpecks:{value:L.skySpecks},uCloud:{value:new THREE.Vector4},uCloudCol:{value:new THREE.Vector3},uHillsA:{value:new THREE.Vector4},uHillSnow:{value:new THREE.Vector3},uHillBlue:{value:new THREE.Vector3},uRangeRock:{value:new THREE.Vector3},uRangeC:{value:new THREE.Vector4},uMist:{value:new THREE.Vector4},uWaterB:{value:new THREE.Vector4(1,0,.55,0)},uRing:{value:new THREE.Vector4(0,20,0,3)},uRing2:{value:new THREE.Vector4(0,.03,0,0)},uFootInfo:{value:new THREE.Vector4(2,-MARK_DIST,1/128,0)},uFoot:{value:null},uPointerRipples:{value:Array.from({length:3},()=>new THREE.Vector4(0,0,-1e6,0))}},blank=new THREE.DataTexture(new Uint8Array([203,216,230,255]),1,1);blank.needsUpdate=!0,U.uRangeTex.value=blank;const backdropMat=new THREE.ShaderMaterial({vertexShader:BACKDROP_VERTEX,fragmentShader:BACKDROP_FRAGMENT(OCT,LAYERS),uniforms:U,depthTest:!1,depthWrite:!1,toneMapped:!1,blending:THREE.NoBlending}),backdrop=new THREE.Mesh(new THREE.PlaneGeometry(2,2),backdropMat);backdrop.name="lakeBackdrop",backdrop.frustumCulled=!1,backdrop.renderOrder=-100,scene.add(backdrop);const MAX_MOTES=small?160:480,nearMarkCount=globalThis.document?.documentElement?.matches?.('[data-look="index1-5"]:not([data-opening-refinement])')?small?72:180:0,markBounds=new THREE.Box3;let markLo=0,markHi=0,orbitClockStarted=!1;const moteGeo=new THREE.BufferGeometry;{const seed=new Float32Array((MAX_MOTES+nearMarkCount)*4),pos=new Float32Array((MAX_MOTES+nearMarkCount)*3);let s=1234567;const rnd=()=>(s=s*16807%2147483647)/2147483647;for(let i=nearMarkCount;i<MAX_MOTES+nearMarkCount;i++)seed[i*4]=rnd()*2-1,seed[i*4+1]=rnd(),seed[i*4+2]=rnd(),seed[i*4+3]=rnd();s=89371;for(let i=0;i<nearMarkCount;i++)seed[i*4]=rnd()*2-1,seed[i*4+1]=(i+rnd()*.7)/nearMarkCount,seed[i*4+2]=rnd(),seed[i*4+3]=2+rnd();moteGeo.setAttribute("position",new THREE.BufferAttribute(pos,3)),moteGeo.setAttribute("aSeed",new THREE.BufferAttribute(seed,4)),moteGeo.setDrawRange(0,0)}const MU={uMarkCenter:{value:new THREE.Vector3},uMarkExtent:{value:new THREE.Vector3},uMarkVisibility:{value:0},uSoft:{value:1},uOrbitShutter:{value:new THREE.Vector2},uOrbitClock:{value:new THREE.Vector2},uOrbitStyle:{value:new THREE.Vector4},uOrbitSpread:{value:new THREE.Vector2},uOrbitPointer:{value:new THREE.Vector4(0,0,0,1)},uTime:U.uTime,uSpeed:{value:1},uSize:{value:1},uResY:{value:H},uCount:{value:0},uView:{value:new THREE.Vector4(.325,1.6,-.2,L.camHeight)},uDepth:{value:new THREE.Vector2(2.5,30)},uColor:{value:new THREE.Vector3(1,.95,.88)},uSkyTint:{value:new THREE.Vector3(.35,.45,.6)},uSunV:{value:new THREE.Vector2(-.5,.4)},uOpacity:{value:.8},uDisplay:{value:1}},orbitPointerTarget=new THREE.Vector2,orbitPointerCurrent=new THREE.Vector2,orbitPointerRay=new THREE.Vector3;let orbitPointerSeen=!1,orbitPointerAt=-1/0,orbitPointerWeight=0;const orbitPointerEnabled=nearMarkCount>0&&!reducedMotion,waterPointerEnabled=orbitPointerEnabled&&!small&&matchMedia("(pointer: fine)").matches,waterPointerRay=new THREE.Vector3,waterLastPoint=new THREE.Vector2(1/0,1/0);let waterPointerSlot=0,waterPointerStamp=-1/0,waterPointerEmitted=0;const stopOrbitPointer=()=>{orbitPointerAt=-1/0},moveOrbitPointer=event=>{if(!orbitPointerEnabled||event.isPrimary===!1||MU.uMarkVisibility.value<.01||renderer.domElement.style.visibility==="hidden")return;if(event.target?.closest?.(".lgp,#tuner,.letters-panel,button,a,input,textarea,select,[contenteditable]")){stopOrbitPointer();return}const box=renderer.domElement.getBoundingClientRect();if(!box.width||!box.height)return;const x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;if(x<0||x>1||y<0||y>1){stopOrbitPointer();return}if(orbitPointerTarget.set(x*2-1,1-y*2),orbitPointerSeen||(orbitPointerCurrent.copy(orbitPointerTarget),orbitPointerSeen=!0),orbitPointerAt=performance.now(),waterPointerEnabled&&event.pointerType==="mouse"&&orbitPointerAt-waterPointerStamp>160&&(waterPointerRay.set(x*2-1,1-y*2,.5).unproject(camera).sub(camera.position).normalize(),waterPointerRay.y<-.045)){const distance=-camera.position.y/waterPointerRay.y,wx=camera.position.x+waterPointerRay.x*distance,wz=camera.position.z+waterPointerRay.z*distance;distance>0&&distance<28&&(event.type==="pointerdown"||Math.hypot(wx-waterLastPoint.x,wz-waterLastPoint.y)>.22)&&(U.uPointerRipples.value[waterPointerSlot].set(wx,wz,U.uTime.value,.0035),waterPointerSlot=(waterPointerSlot+1)%3,waterPointerEmitted++,waterPointerStamp=orbitPointerAt,waterLastPoint.set(wx,wz))}},releaseOrbitPointer=event=>{event.pointerType!=="mouse"&&stopOrbitPointer()},leaveOrbitPointer=event=>{event.relatedTarget||stopOrbitPointer()};orbitPointerEnabled&&(window.addEventListener("pointermove",moveOrbitPointer,{passive:!0}),window.addEventListener("pointerdown",moveOrbitPointer,{passive:!0}),window.addEventListener("pointerup",releaseOrbitPointer,{passive:!0}),window.addEventListener("pointercancel",stopOrbitPointer,{passive:!0}),window.addEventListener("pointerout",leaveOrbitPointer,{passive:!0}),window.addEventListener("blur",stopOrbitPointer));const motes=new THREE.Points(moteGeo,new THREE.ShaderMaterial({defines:nearMarkCount?{LOGO_NEAR_SPECKS:1}:{},vertexShader:MOTE_VERTEX,fragmentShader:MOTE_FRAGMENT,uniforms:MU,transparent:!0,depthWrite:!1,toneMapped:!1}));motes.name="lakeMotes",motes.frustumCulled=!1,motes.renderOrder=20,scene.add(motes);const sparkGeo=new THREE.BufferGeometry;sparkGeo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(9),3)),sparkGeo.setAttribute("aSeed",new THREE.BufferAttribute(new Float32Array([-.74,.64,.1,.31,.62,.7,.55,.77,-.28,.84,.9,.53]),4)),sparkGeo.setDrawRange(0,0);const SU={uTime:U.uTime,uSpeed:{value:1},uSize:{value:1},uResY:MU.uResY,uView:MU.uView,uColor:{value:new THREE.Vector3(.3,.5,1)},uOpacity:{value:1},uDisplay:MU.uDisplay},sparks=new THREE.Points(sparkGeo,new THREE.ShaderMaterial({vertexShader:SPARK_VERTEX,fragmentShader:SPARK_FRAGMENT,uniforms:SU,transparent:!0,depthWrite:!1,toneMapped:!1}));sparks.name="lakeSparks",sparks.frustumCulled=!1,sparks.renderOrder=21,sparks.visible=!1,scene.add(sparks);const lightSpecks=createLightSpecks({scene,mode:"lake",small,reducedMotion,getConfig:()=>{const c=globalThis.__MONTIS_STUDY__?.CONFIG.lightSpecks||{};return{...c,count:Math.round((c.count??1e3)*L.speckDensity),opacity:(c.opacity??.82)*L.seaOpacity,size:(c.size??1.15)*L.seaSize,rise:L.seaRise,air:L.seaAir,waterGlow:(c.waterGlow??.9)*L.seaRings,centre:L.seaCentre}}}),rangeBackgroundPaused=!!globalThis.document?.documentElement?.matches?.('[data-look="index1-5"]:not([data-opening-refinement]):not([data-range-background])');let rangeTex=null,rangeLoading=!rangeBackgroundPaused,rangeReady=!1;if(!rangeBackgroundPaused){const bases=[];assetBase&&bases.push(String(assetBase).replace(/\/*$/,"/"));try{bases.push(new URL("../assets/",import.meta.url).href,new URL("./assets/",import.meta.url).href)}catch{}const loader=new THREE.TextureLoader,tryNext=i=>{if(!disposed){if(i>=bases.length){rangeLoading=!1,console.warn("index1-5 logo seal: opening-range.webp not found; the horizon stays clear.");return}loader.load(bases[i]+"opening-range.webp",tex=>{if(disposed){tex.dispose();return}tex.colorSpace=THREE.NoColorSpace,tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping,tex.generateMipmaps=!0,tex.minFilter=THREE.LinearMipmapLinearFilter,tex.magFilter=THREE.LinearFilter,tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy()),tex.needsUpdate=!0,rangeTex=tex,U.uRangeTex.value=tex,rangeLoading=!1,rangeReady=!0,applyLook(),envDirty=!0,readyResolvers.splice(0).forEach(f=>f())},void 0,()=>tryNext(i+1))}};tryNext(0)}const readyResolvers=[],mirrorCam=new THREE.PerspectiveCamera;let mirrorRT=null,inMirror=!1;const mirrorTex=new THREE.Matrix4,_rot=new THREE.Matrix4,_p=new THREE.Vector3,_t=new THREE.Vector3;let convRT=null;const convCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),convScene=new THREE.Scene,convMat=new THREE.ShaderMaterial({uniforms:{tColor:{value:null},tDepth:{value:null}},depthTest:!1,depthWrite:!1,toneMapped:!1,vertexShader:"varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",fragmentShader:`uniform sampler2D tColor, tDepth; varying vec2 vUv;
      void main() { float m = 1. - smoothstep(.9985, .99995, texture2D(tDepth, vUv).r); gl_FragColor = vec4(texture2D(tColor, vUv).rgb * m, m); }`}),convQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),convMat);convQuad.frustumCulled=!1,convScene.add(convQuad);const footRT=new THREE.WebGLRenderTarget(128,1,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:!1,generateMipmaps:!1,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});footRT.texture.name="lakeFootprint";const footScene=new THREE.Scene,footMat=new THREE.ShaderMaterial({uniforms:{tMark:{value:null},uMat:U.uMirrorMat,uFootA:{value:new THREE.Vector4(2,-MARK_DIST,1.2,.3)}},depthTest:!1,depthWrite:!1,toneMapped:!1,vertexShader:"void main() { gl_Position = vec4(position.xy, 0., 1.); }",fragmentShader:FOOT_FRAGMENT}),footQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),footMat);footQuad.frustumCulled=!1,footScene.add(footQuad),U.uFoot.value=footRT.texture;function makeMirror(){mirrorRT&&(mirrorRT.depthTexture?.dispose(),mirrorRT.dispose()),convRT&&convRT.dispose();const mw=Math.max(64,Math.round(W*mirrorScale)),mh=Math.max(64,Math.round(H*mirrorScale));mirrorRT=new THREE.WebGLRenderTarget(mw,mh,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:!0,depthTexture:new THREE.DepthTexture(mw,mh),minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:!1}),mirrorRT.texture.name="lakeMirror",convRT=new THREE.WebGLRenderTarget(mw,mh,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:!1,generateMipmaps:!0,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter}),convRT.texture.name="lakeMirrorPremult",convMat.uniforms.tColor.value=mirrorRT.texture,convMat.uniforms.tDepth.value=mirrorRT.depthTexture,footMat.uniforms.tMark.value=convRT.texture,U.uMirrorColor.value=convRT.texture}function mirrorFrom(cam){cam.updateMatrixWorld(),_p.setFromMatrixPosition(cam.matrixWorld),_rot.extractRotation(cam.matrixWorld),_t.set(0,0,-1).applyMatrix4(_rot).add(_p),_t.y=-_t.y,mirrorCam.position.set(_p.x,-_p.y,_p.z),mirrorCam.up.set(0,1,0).applyMatrix4(_rot),mirrorCam.up.y=-mirrorCam.up.y,mirrorCam.lookAt(_t),mirrorCam.near=cam.near,mirrorCam.far=cam.far,mirrorCam.updateMatrixWorld(),mirrorCam.projectionMatrix.copy(cam.projectionMatrix),mirrorCam.projectionMatrixInverse.copy(cam.projectionMatrixInverse),mirrorTex.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),mirrorTex.multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse),U.uMirrorMat.value.copy(mirrorTex)}scene.onBeforeRender=(r,sc,cam)=>{if(inMirror||disposed||L.reflStrength<=0||!mirrorRT||!markShown||!markAnchor.visible)return;inMirror=!0;const prevTarget=r.getRenderTarget(),prevXr=r.xr.enabled,prevAuto=r.autoClear,prevShadow=r.shadowMap.autoUpdate,specksVisible=lightSpecks.points.visible;try{mirrorFrom(cam),U.uMirror.value=1,motes.visible=!1,sparks.visible=!1,lightSpecks.points.visible=!1,r.xr.enabled=!1,r.shadowMap.autoUpdate=!1,r.autoClear=!0,r.setRenderTarget(mirrorRT),r.render(sc,mirrorCam),r.setRenderTarget(convRT),r.render(convScene,convCam),footOn&&(r.setRenderTarget(footRT),r.render(footScene,convCam))}finally{r.setRenderTarget(prevTarget),r.xr.enabled=prevXr,r.autoClear=prevAuto,r.shadowMap.autoUpdate=prevShadow,U.uMirror.value=0,motes.visible=!0,sparks.visible=sparkShown,inMirror=!1,lightSpecks.points.visible=specksVisible}},makeMirror();let pmrem=null,envRT=null,envOld=null,envScene=null,envMesh=null,envVersion=0,envDirty=!0;const envSize=small?128:256;function ensureEnvironmentScene(){if(!envScene){envScene=new THREE.Scene;const envU={...U,uSunB:{value:new THREE.Vector4(.6,5,0,0)}};envMesh=new THREE.Mesh(new THREE.SphereGeometry(100,48,24),new THREE.ShaderMaterial({vertexShader:ENV_VERTEX,fragmentShader:ENV_FRAGMENT,uniforms:envU,side:THREE.BackSide,depthWrite:!1,depthTest:!1,toneMapped:!1})),envScene.add(envMesh)}}function bakeEnvironment(){envDirty=!1,pmrem||(pmrem=new THREE.PMREMGenerator(renderer)),ensureEnvironmentScene(),envMesh.material.uniforms.uSunB.value.set(U.uSunB.value.x,5,0,0);const next=pmrem.fromScene(envScene,0,1,300,{size:envSize});if(envOld&&envOld.dispose(),envOld=envRT,envRT=next,scene.environment=envRT.texture,envVersion++,api.onEnvironment)try{api.onEnvironment(envRT.texture)}catch(e){console.error(e)}}let prepared=!1,prepareTask=null;const preparation={};function prepare(){if(prepareTask)return prepareTask;ensureEnvironmentScene();const target=new THREE.WebGLRenderTarget(8,8,{type:THREE.HalfFloatType}),envCamera=new THREE.PerspectiveCamera(90,1,1,300),compileAt=async(name,s,c,rt)=>{const t=performance.now(),previous=renderer.getRenderTarget();let pending;try{renderer.setRenderTarget(rt),pending=renderer.compileAsync?renderer.compileAsync(s,c):Promise.resolve(renderer.compile(s,c))}finally{renderer.setRenderTarget(previous)}await pending,preparation[name]=Math.round(performance.now()-t)};return prepareTask=(async()=>{if(await Promise.all([compileAt("environmentShader",envScene,envCamera,target),compileAt("footprintShader",footScene,convCam,footRT),compileAt("reflectionShader",convScene,convCam,convRT)]),disposed||(await new Promise(resolve=>setTimeout(resolve,0)),disposed))return;let t=performance.now();if(bakeEnvironment(),preparation.environmentBake=Math.round(performance.now()-t),await new Promise(resolve=>setTimeout(resolve,0)),disposed)return;const previous=renderer.getRenderTarget();t=performance.now();try{footMat.uniforms.uFootA.value.w=2,renderer.setRenderTarget(footRT),renderer.render(footScene,convCam)}finally{renderer.setRenderTarget(previous)}preparation.footprintDraw=Math.round(performance.now()-t),prepared=!0})().finally(()=>target.dispose()),prepareTask}const _c=new THREE.Color,setCol=(u,hex,k=1)=>{_c.set(hex),u.value.set(_c.r*k,_c.g*k,_c.b*k)};let sunQ=0;function applyQ(){const k=L.qLight*(1-sunQ),az=(L.sunAz*lerp(1,L.portraitSunShift,frame.pt)-8*frame.pt)*RAD,el=(L.sunEl+2.2*k)*RAD;U.uSunDir.value.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)).normalize(),U.uSunA.value.set(L.sunSize*RAD,L.sunDisc,L.sunBloom*(1-.15*k),Math.max(.5,L.sunBloomSize)*RAD),U.uOut.value.x=L.exposure*(1+.05*k),sunLight.position.copy(sunLight.target.position).addScaledVector(U.uSunDir.value,30);const sd=U.uSunDir.value;MU.uSunV.value.set(sd.x*.8,sd.y*1.6+.1)}function rangeLodBase(){const texPerDeg=2048/Math.max(6,L.rangeWidth),pxPerDeg=H/Math.max(10,frame.fov);return Math.log2(Math.max(1,texPerDeg/pxPerDeg))}function syncOpeningLook(){if(L.matchOpening<.5)return;const opening=globalThis.__FINNOVATION_OPENING_LOOK__;if(!opening)return;const F=opening.field,C=opening.world,next={skyTop:F.top,skyMid:F.upper,skyHorizon:F.horizon,deep:F.lower,lit:F.upper,ink:F.ink,sunAz:C.sunAzimuth,sunEl:C.sunElevation,sunColor:C.sunColor,bloomColor:C.sunColor,sunDisc:C.sunDisc,sunCore:F.core,glintColor:C.glintColor,glintStrength:C.glintStrength,rangeOpacity:C.rangeOpacity,rangeHeight:C.rangeHeight,rangeWidth:C.rangeWidth,rangeAz:C.rangeAzimuth,rangeHaze:C.rangeHaze,rangeSoft:C.rangeSoft,moteColor:C.moteColor};for(const[key,value]of Object.entries(next))value!==void 0&&L[key]!==value&&(L[key]=value,envDirty=!0);U.uOpeningSun.value.set(F.core,F.coreSpread,C.sunStrength,C.goldHorizon),opening.view&&U.uOpeningVeil.value.set(opening.view.veil,Math.tan(opening.view.fov*.5*RAD))}function applyLook(){setCol(U.uTop,L.skyTop),setCol(U.uMid,L.skyMid),setCol(U.uHorizon,L.skyHorizon),setCol(U.uHaze,L.skyHaze),U.uSkyA.value.set(L.skyMidEl*RAD,L.skyCurve,L.skyTopEl*RAD,Math.max(.2,L.hazeHeight)*RAD),U.uSkyB.value.set(L.hazeAmount,L.matchOpening,0,0),setCol(U.uSunCol,L.sunColor),setCol(U.uBloomCol,L.bloomColor),U.uSunB.value.set(L.sunCore,1,0,0),U.uRangeA.value.set(rangeReady?L.rangeOpacity:0,L.rangeHaze,Math.tan(Math.max(6,L.rangeWidth)*.5*RAD),L.rangeAz*RAD),U.uRangeB.value.set(L.rangeLift*RAD,Math.max(.5,L.rangeHeight)*RAD,rangeLodBase()+L.rangeSoft,L.rangeContrast),setCol(U.uRangeTint,L.rangeTint),U.uWater.value.set(L.waterScale,L.waterStretch,L.waterSpeed,L.waterRough),U.uSwell.value=Math.min(.12,Math.max(0,L.waterSwell)),U.uSkySpecks.value=L.skySpecks,setCol(U.uDeep,L.deep),setCol(U.uLit,L.lit),setCol(U.uInk,L.ink),setCol(U.uFoam,L.foam),U.uFres.value.set(L.fresnelMin,L.fresnelPower,L.skyReflect,L.waterNearDark),U.uGlintA.value.set(L.glintStrength,lerp(900,28,clamp(L.glintSize)),Math.max(1,L.glintBand)*RAD,L.glintFocus),U.uGlintB.value.set(L.glintKnee,L.glintSpread,0,0),setCol(U.uGlintCol,L.glintColor),U.uRefl.value.set(L.reflStrength,L.reflLength,L.reflRipple,L.reflBlur),U.uOut.value.set(L.exposure,L.vignette,L.outputDisplay>.5?1:0,0),MU.uSpeed.value=L.moteSpeed,MU.uSize.value=L.moteSize,MU.uOpacity.value=L.moteOpacity,MU.uDisplay.value=L.outputDisplay>.5?1:0,MU.uSoft.value=clamp(L.orbitSoft,0,2);{const sh=reducedMotion?0:clamp(L.orbitShutter,0,.05);MU.uOrbitShutter.value.set(sh*clamp(L.orbitSpeed,0,3),sh*clamp(L.orbitRiseSpeed,0,3))}MU.uOrbitStyle.value.set(clamp(L.orbitRandomness,0,100)/100,clamp(L.orbitRadius,.65,2),clamp(L.orbitSize,.4,2),clamp(L.orbitBrightness,0,2)),MU.uOrbitSpread.value.set(clamp(L.orbitDensity,0,100)/100,clamp(L.orbitScatter,0,2)),setCol(MU.uColor,L.moteColor);{const sky=new THREE.Color(L.skyMid).lerp(new THREE.Color(L.skyHorizon),.35);MU.uSkyTint.value.set(sky.r*1.1,sky.g*1.1,sky.b*1.2)}moteGeo.setDrawRange(0,nearMarkCount+Math.round(clamp(L.moteCount,0,MAX_MOTES))),sunLight.color.set(L.sunColor),sunLight.intensity=L.lightSun,sunLight.target.position.set(0,0,-MARK_DIST);const openingWorld=L.matchOpening>.5?globalThis.__FINNOVATION_OPENING_LOOK__?.world:null;fillLight.color.set(openingWorld?.hemiSky||L.skyMid),fillLight.groundColor.set(openingWorld?.hemiGround||L.deep),fillLight.intensity=L.lightFill,scene.environmentIntensity=L.envIntensity,U.uCloud.value.set(L.cloudAmount,L.cloudScale,L.cloudSpeed,0),setCol(U.uCloudCol,L.cloudColor),U.uHillsA.value.set(L.hills,L.hillHeight*RAD,L.hillScale,L.hillSharp),setCol(U.uHillSnow,L.hillSnow),setCol(U.uHillBlue,L.hillBlue),setCol(U.uRangeRock,L.rangeRock),U.uRangeC.value.set(L.rangeRockMix,0,0,0),U.uMist.value.set(L.mistAmount,Math.max(.2,L.mistHeight)*RAD,Math.max(2,L.mistWidth)*RAD,0),U.uWaterB.value.set(L.waterFine,L.reflWobble,L.waterTint,0),SU.uSpeed.value=L.sparkSpeed,SU.uSize.value=L.sparkSize,setCol(SU.uColor,L.sparkColor);{const n=Math.round(clamp(L.sparkCount,0,3));sparkGeo.setDrawRange(0,n),sparkShown=n>0,sparks.visible=sparkShown}applyQ(),applyRise()}let markAspect=1;const frame={pt:0,cy:1,Hm:1,fov:L.fov,horizon:L.horizon,T:Math.tan(L.fov*.5*RAD),y0:1-2*L.horizon,markDist:MARK_DIST};function layout(){const aspect=W/H,pt=smooth(1.15,.72,aspect);frame.pt=pt,frame.fov=lerp(L.fov,L.fovPortrait,pt),frame.horizon=lerp(L.horizon,L.portraitHorizon,pt);const markY=lerp(L.markY,L.portraitMarkY,pt),shortK=lerp(1,clamp(L.shortSize,.4,1),smooth(L.shortFrom,L.shortTo,window.innerHeight||H)),markSize=Math.min(lerp(L.markSize,L.portraitMarkSize,pt)*shortK,aspect*lerp(L.markWidth,Math.min(.9,L.markWidth+.1),pt)/Math.max(1,markAspect));frame.T=Math.tan(frame.fov*.5*RAD),frame.y0=1-2*frame.horizon,camera.aspect=aspect,camera.fov=frame.fov,camera.updateProjectionMatrix();const Hv=2*MARK_DIST*frame.T,half=markSize*Hv*.5,cy=Math.max(L.camHeight+(frame.horizon-markY)*Hv,half+.03);frame.cy=cy,frame.Hm=markSize*Hv,markAnchor.scale.setScalar(markSize*Hv),U.uPix.value=2*frame.T/H,U.uCamH.value=L.camHeight,U.uRes.value.set(W,H),MU.uResY.value=H,MU.uView.value.set(frame.T,aspect,frame.y0,L.camHeight),MU.uDepth.value.set(2.5,30),applyLook()}camera.updateProjectionMatrix=function(){const n=this.near,T=Math.tan(this.fov*.5*RAD),ht=2*n*T,wd=ht*this.aspect,b=-ht*(1+frame.y0)*.5,t=b+ht;this.projectionMatrix.makePerspective(-wd*.5,wd*.5,t,b,n,this.far),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()};const clipPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),clipList=[clipPlane],clipped=new WeakSet,clippedList=[],prevLocalClipping=renderer.localClippingEnabled;renderer.localClippingEnabled=!0;let riseE=1,lastRiseE=1,ringE=0,ringPhase=0,lastTT=0,ringOn=!1,footOn=!1,contact=0,markShown=!0,riseHidden=!1,sparkShown=!1;const riseEase=r=>{const sm=r*r*r*(r*(r*6-15)+10);return lerp(r,sm,clamp(L.riseCurve))};function clipMark(){markAnchor.traverse(o=>{const ms=o.material?Array.isArray(o.material)?o.material:[o.material]:null;if(ms)for(const m of ms)clipped.has(m)||(clipped.add(m),clippedList.push(m),m.clippingPlanes=clipList,m.needsUpdate=!0)})}function applyRise(){const Hm=frame.Hm,trueFoot=L.riseTrueFoot>.5&&markHi>0,halfHi=trueFoot?markHi:Hm*.5,halfLo=trueFoot?-markLo:Hm*.5,startY=Math.min(frame.cy-L.riseSink*Hm,trueFoot?-(halfHi+.03):-Hm*.55),y=lerp(startY,frame.cy,riseE);markAnchor.position.set(0,y,-MARK_DIST);const foot=y-halfLo;markShown=y+halfHi>-.02,!markShown&&markAnchor.visible?(markAnchor.visible=!1,riseHidden=!0):markShown&&riseHidden&&(markAnchor.visible=!0,riseHidden=!1),clipPlane.constant=riseE>=.9999?1e3:0,contact=markShown?1-smooth(-.12,.002,foot/Hm):0,U.uRefl.value.x=markShown?L.reflStrength:0,U.uRefl2.value.set(L.reflFresnel,Math.max(foot,0),Hm,MARK_DIST)}let lastQ=-1,daylightHour=-100,daylightOn=!1,lastDaylightMove=0,lastDaylightBake=0;const daylightColor=new THREE.Color,daylightVector=(uniform,color,scale=1)=>uniform.value.set(color.r*scale,color.g*scale,color.b*scale);function applyDaylight(){const D=getSceneDaylight();if(L.matchOpening>.5||!D.enabled||L.preset==="glacier"){daylightOn&&(applyLook(),envDirty=!0),daylightOn=!1;return}daylightOn=!0;const now=performance.now();Math.abs(D.hour-daylightHour)>.002&&(daylightHour=D.hour,lastDaylightMove=now),daylightVector(U.uTop,D.skyTop),daylightVector(U.uMid,D.skyMid),daylightVector(U.uHorizon,D.horizon),daylightVector(U.uHaze,D.fog),daylightVector(U.uRangeTint,D.fog,.72),daylightVector(U.uDeep,D.sea,.65),daylightVector(U.uLit,D.fog,.75),daylightVector(U.uInk,D.sea,.26),daylightVector(U.uFoam,D.cloudLit),daylightVector(U.uSunCol,D.sunColor),daylightVector(U.uBloomCol,D.sunColor),U.uSunDir.value.copy(D.sunDirection);const energy=Math.min(1.5,Math.max(0,D.intensity/4.5));U.uSunA.value.set(L.sunSize*RAD,L.sunDisc*energy,L.sunBloom*energy,Math.max(.5,L.sunBloomSize)*RAD),U.uSunB.value.x=L.sunCore*energy,U.uGlintA.value.x=L.glintStrength*energy,daylightVector(U.uGlintCol,D.sunColor),daylightVector(MU.uColor,D.cloudLit),daylightVector(MU.uSkyTint,D.skyMid,1.1),sunLight.position.copy(sunLight.target.position).addScaledVector(D.sunDirection,30),sunLight.color.copy(D.sunColor),sunLight.intensity=L.lightSun*energy,fillLight.color.copy(D.shadow),fillLight.groundColor.copy(D.sea),fillLight.intensity=Math.max(.4,L.lightFill),now-lastDaylightMove>180&&Math.abs(daylightHour-lastDaylightBake)>.12&&(envDirty=!0,lastDaylightBake=daylightHour)}function update({q=0,time=0,rise=1}={}){if(disposed)return;const qq=reducedMotion?1:clamp(q),tt=reducedMotion?STATIC_TIME:time;U.uTime.value=tt,riseE=reducedMotion?1:riseEase(clamp(rise)),clipMark();const dR=Math.abs(riseE-lastRiseE);lastRiseE=riseE;const dtt=clamp(tt-lastTT,0,.12);lastTT=tt,reducedMotion?ringE=0:(ringE=Math.min(2.2,ringE*Math.exp(-dtt/Math.max(.2,L.ringDecay))+dR*18),ringPhase+=dR*L.riseSink*Math.PI*2/Math.max(.05,L.ringSpacing)*.8),applyRise();{const Hm=frame.Hm,kk=Math.PI*2/(Math.max(.05,L.ringSpacing)*Hm),xr=Math.max(.8*Hm,1);footOn=markShown&&contact>.01,ringOn=!reducedMotion&&(footOn||ringE>.004),U.uRing.value.set(L.ringAmp*.05*Math.min(ringE,1.6),kk,ringPhase+kk*L.ringSpeed*Hm*tt,Math.max(.2,L.ringReach)*Hm),U.uRing2.value.set(L.meniscus*contact,Math.max(.002,L.meniscusWidth)*Hm,L.pushAmp*.012*contact*(.5+.5*Math.min(ringE,1)),ringOn?1:0),U.uFootInfo.value.set(xr,-MARK_DIST,1/128,L.cutGlow),footMat.uniforms.uFootA.value.set(xr,-MARK_DIST,1.2,.3)}if(Math.abs(qq-lastQ)>1e-4&&(lastQ=qq,sunQ=qq,applyQ()),applyDaylight(),nearMarkCount){const clock=MU.uOrbitClock.value;orbitClockStarted?reducedMotion||(clock.x+=dtt*clamp(L.orbitSpeed,0,3),clock.y+=dtt*clamp(L.orbitRiseSpeed,0,3)):(clock.set(STATIC_TIME,STATIC_TIME),orbitClockStarted=!0),markAnchor.updateWorldMatrix(!0,!0),markBounds.setFromObject(markAnchor);const ready=markShown&&!markBounds.isEmpty();MU.uMarkVisibility.value=ready?smooth(.55,.95,riseE):0,ready&&(markBounds.getCenter(MU.uMarkCenter.value),markBounds.getSize(MU.uMarkExtent.value).multiplyScalar(.5)),markBounds.isEmpty()||(markLo=markBounds.min.y-markAnchor.position.y,markHi=markBounds.max.y-markAnchor.position.y)}lightSpecks.update({time:tt,camera,width:W,height:H,progress:qq*5});const e=qq*qq*(3-2*qq),push=L.drift*MARK_DIST*(1-e),sw=reducedMotion?0:L.sway*RAD;if(camera.position.set(Math.sin(tt*.09)*.06*L.sway,L.camHeight,push),camera.rotation.set(Math.sin(tt*.071+1.3)*.5*sw,Math.sin(tt*.053)*sw,0),camera.updateMatrixWorld(),orbitPointerEnabled){const active=MU.uMarkVisibility.value>.01&&performance.now()-orbitPointerAt<1e3,ease=1-Math.exp(-dtt*6);orbitPointerWeight+=((active?1:0)-orbitPointerWeight)*ease,orbitPointerCurrent.lerp(orbitPointerTarget,1-Math.exp(-dtt*9)),orbitPointerRay.set(orbitPointerCurrent.x,orbitPointerCurrent.y,.5).unproject(camera).sub(camera.position).normalize();const distance=(MU.uMarkCenter.value.z-camera.position.z)/Math.min(-.001,orbitPointerRay.z);MU.uOrbitPointer.value.set(camera.position.x+orbitPointerRay.x*distance,camera.position.y+orbitPointerRay.y*distance,orbitPointerWeight*clamp(L.orbitInteraction,0,3),MU.uMarkExtent.value.y*.85)}U.uRefl2.value.w=camera.position.z-markAnchor.position.z,envDirty&&prepared&&bakeEnvironment()}function setSize(w,h){W=Math.max(2,w|0),H=Math.max(2,h|0),layout(),makeMirror()}function applyPreset(name){const P=LAKE_PRESETS[name]||LAKE_PRESETS.dusk;name=LAKE_PRESETS[name]?name:"dusk";for(const k of Object.keys(LAKE_DEFAULTS))k==="preset"||k==="glacierMode"||(L[k]=k in P?P[k]:k in paletteOv?paletteOv[k]:LAKE_DEFAULTS[k]);L.preset=name,L.glacierMode=name==="glacier"?1:0}function setLook(next={}){let env=!1,name=null;typeof next.preset=="string"?name=next.preset:next.glacierMode!==void 0&&(name=Number(next.glacierMode)>.5?"glacier":"dusk"),name!==null&&(name!==L.preset||next.reset===!0)&&(applyPreset(name),env=!0);for(const k of Object.keys(next)){if(!(k in LAKE_DEFAULTS)||k==="preset"||k==="glacierMode")continue;let v=next[k];if(COLOR_KEYS.includes(k)){if(typeof v!="string"||!HEX.test(v))continue}else if(v=Number(v),!Number.isFinite(v))continue;L[k]!==v&&(L[k]=v,ENV_KEYS.has(k)&&(env=!0))}syncOpeningLook(),layout(),env&&(envDirty=!0)}function dispose(){if(!disposed){disposed=!0,scene.onBeforeRender=()=>{},orbitPointerEnabled&&(window.removeEventListener("pointermove",moveOrbitPointer),window.removeEventListener("pointerdown",moveOrbitPointer),window.removeEventListener("pointerup",releaseOrbitPointer),window.removeEventListener("pointercancel",stopOrbitPointer),window.removeEventListener("pointerout",leaveOrbitPointer),window.removeEventListener("blur",stopOrbitPointer)),lightSpecks.dispose(),renderer.localClippingEnabled=prevLocalClipping;for(const m of clippedList)m.clippingPlanes=null,m.needsUpdate=!0;riseHidden&&(markAnchor.visible=!0,riseHidden=!1),footQuad.geometry.dispose(),footMat.dispose(),footRT.dispose(),sparkGeo.dispose(),sparks.material.dispose(),scene.remove(backdrop,motes,sparks,markAnchor,sunLight,sunLight.target,fillLight),backdrop.geometry.dispose(),backdropMat.dispose(),moteGeo.dispose(),motes.material.dispose(),blank.dispose(),rangeTex?.dispose(),convQuad.geometry.dispose(),convMat.dispose(),convRT&&(convRT.dispose(),convRT=null),mirrorRT&&(mirrorRT.depthTexture?.dispose(),mirrorRT.dispose(),mirrorRT=null),envRT&&(envRT.dispose(),envRT=null),envOld&&(envOld.dispose(),envOld=null),envMesh&&(envMesh.geometry.dispose(),envMesh.material.dispose()),pmrem?.dispose(),pmrem=null,scene.environment=null,api.onEnvironment=null}}const api={scene,camera,markAnchor,prepare,get preparation(){return{prepared,...preparation}},get environment(){return envRT?envRT.texture:null},get environmentVersion(){return envVersion},get ready(){return rangeReady||!rangeLoading},whenReady(){return rangeReady||!rangeLoading?Promise.resolve():new Promise(res=>readyResolvers.push(res))},onEnvironment:null,warm(){return renderer.compileAsync?renderer.compileAsync(scene,camera).then(()=>renderer.compileAsync(convScene,convCam)):(renderer.compile(scene,camera),Promise.resolve())},update,setSize,setLook,dispose,setMarkAspect(value){const next=Math.max(.1,Number(value)||1);Math.abs(next-markAspect)>.001&&(markAspect=next,layout())},getLook(){return{...L}},get interaction(){return{enabled:waterPointerEnabled,emitted:waterPointerEmitted,active:U.uPointerRipples.value.filter(hit=>hit.w>0&&U.uTime.value-hit.z>=0&&U.uTime.value-hit.z<3.2).length}}};return syncOpeningLook(),layout(),update({q:0,time:0}),api}