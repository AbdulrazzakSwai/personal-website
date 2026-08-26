---
title: "CyberDefenders: Tusk Infostealer"
date: 2026-08-02
summary: "An Easy Linux defensive lab focusing on threat intelligence analysis of the Tusk infostealer campaign targeting blockchain developers through typosquatted DAO platforms and fake AI tools. Threat intel analysis reveals password-protected Dropbox archive payloads, secondary malware delivery, C2 infrastructure, Ethereum wallet drainers, and targeted telemetry harvesting."
platform: "CyberDefenders"
type: "Defensive Lab"
difficulty: "Easy"
os: "Linux"
link: "https://cyberdefenders.org/blueteam-ctf-challenges/tusk-infostealer/"
tags:
  - cyberdefenders
  - danabot
  - dropbox
  - easy
  - linux
  - stealc
  - threat-intel
  - tusk-infostealer
  - virustotal
---

### Executive Summary

A targeted social engineering attack, known as the "Tusk" infostealer campaign, compromised company endpoints through typosquatted phishing domains (such as `tidyme.io`) masquerading as decentralized autonomous organization (DAO) management tools. The initial malicious payloads, hosted on cloud services like Dropbox, executed password-protected archives containing secondary malware including StealC and Danabot infostealers. Once executed, the malware extracted system telemetry, browser credentials, session data, and local cryptocurrency wallet information, allowing threat actors to unauthorizedly exfiltrate corporate crypto assets.

### Scenario

A blockchain development company detected unusual activity when an employee was redirected to an unfamiliar website while accessing a DAO management platform. Soon after, multiple cryptocurrency wallets linked to the organization were drained. Investigators suspect a malicious tool was used to steal credentials and exfiltrate funds.

Your task is to analyze the provided intelligence to uncover the attack methods, identify indicators of compromise, and track the threat actor’s infrastructure.

### Provided Artifacts

```bash
$ cat hash.txt          
MD5: E5B8B2CF5B244500B22B665C87C11767

Use this hash on online threat intel platforms (e.g., VirusTotal, Hybrid Analysis) to complete the lab analysis.
```

### Task 1

***Question: In KB, what is the size of the malicious file?***

By submitting the hash on VirusTotal, the size of the file can be found in the Details tab under the Basic Properties section:

![Figure 1](/assets/images/writeups/cyberdefenders-tusk-infostealer/cyberdefenders-tusk-infostealer-fig-1.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

***Answer: 921.36***

### Task 2

***Question: What word do the threat actors use in log messages to describe their victims, based on the name of an ancient hunted creature?***

By searching online for security reports related to Tusk Infostealer, [this report by SecureList](https://securelist.com/tusk-infostealers-campaign/113367/) is found to be mentioning strings used by the campaign adversaries:

![Figure 2](/assets/images/writeups/cyberdefenders-tusk-infostealer/cyberdefenders-tusk-infostealer-fig-2.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

***Answer: Mammoth***

### Task 3

***Question: The threat actor set up a malicious website to mimic a platform designed for creating and managing decentralized autonomous organizations (DAOs) on the MultiversX blockchain (peerme.io). What is the name of the malicious website the attacker created to simulate this platform?***

In the same report mentioned in Task 2, the following details are identified:

![Figure 3](/assets/images/writeups/cyberdefenders-tusk-infostealer/cyberdefenders-tusk-infostealer-fig-3.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

***Answer: `tidyme.io`***

### Task 4

***Question: Which cloud storage service did the campaign operators use to host malware samples for both macOS and Windows OS versions?***

In the same report, this detail is clearly mentioned in the following paragraph:

![Figure 4](/assets/images/writeups/cyberdefenders-tusk-infostealer/cyberdefenders-tusk-infostealer-fig-4.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

***Answer: Dropbox***

### Task 5

***Question: The malicious executable contains a configuration file that includes base64-encoded URLs and a password used for archived data decompression, enabling the download of second-stage payloads. What is the password for decompression found in this configuration file?***

The report mentions this key detail in the following section:

![Figure 5](/assets/images/writeups/cyberdefenders-tusk-infostealer/cyberdefenders-tusk-infostealer-fig-5.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

***Answer: `newfile2024`***

### Task 6

***Question: What is the name of the function responsible for retrieving the field archive from the configuration file?***

The following paragraph in the report discusses this point in detail:

![Figure 6](/assets/images/writeups/cyberdefenders-tusk-infostealer/cyberdefenders-tusk-infostealer-fig-6.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

***Answer: `downloadAndExtractArchive`***

### Task 7

***Question: In the third sub-campaign carried out by the operators, the attacker mimicked an AI translator project. What is the name of the legitimate translator, and what is the name of the malicious translator created by the attackers?***

The report discusses the details of this malicious translation project in the following section:

![Figure 7](/assets/images/writeups/cyberdefenders-tusk-infostealer/cyberdefenders-tusk-infostealer-fig-7.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

***Answer: `Yous.ai`, `voico.io`***

### Task 8

***Question: The downloader is tasked with delivering additional malware samples to the victim’s machine, primarily infostealers like StealC and Danabot. What are the IP addresses of the StealC C2 servers used in the campaign?***

In the Network IoCs section of the report, the two IP addresses can be easily identified:

![Figure 8](/assets/images/writeups/cyberdefenders-tusk-infostealer/cyberdefenders-tusk-infostealer-fig-8.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

***Answer: `46.8.238.240`, `23.94.225.177`***

### Task 9

***Question: What is the address of the Ethereum cryptocurrency wallet used in this campaign?***

Under the Cryptocurrency Wallet Addresses section, we can identify the addresses of all used cryptocurrency wallets, which include Ethereum:

![Figure 9](/assets/images/writeups/cyberdefenders-tusk-infostealer/cyberdefenders-tusk-infostealer-fig-9.png)

<figcaption class="blog-image-caption">Figure 9</figcaption>

***Answer: `0xaf0362e215Ff4e004F30e785e822F7E20b99723A`***

---

### Business Impact

#### Confidentiality

- **Credential & Session Theft:** Intruders harvested web browser passwords, session tokens, and system information, exposing sensitive corporate accounts to ongoing unauthorized access.
- **Private Key Exposure:** Cryptocurrency wallet credentials and private seed phrases were compromised, stripping the organization of privacy over its financial assets.

#### Integrity

- **Financial Asset Loss:** Attackers modified clipboard data and directly interacted with compromised web3 wallets to drain corporate cryptocurrency reserves.
- **System & Data Tampering:** Unsanctioned secondary executables (StealC/Danabot) were dropped and executed on employee endpoints, altering local file structures and system configurations.

#### Availability

- **Service Disruption:** Operations involving DAO management and crypto fund transfers were halted due to the compromise and loss of operational wallet funds.
- **System Isolation & Downtime:** Incident response required taking affected employee endpoints offline for triage and re-imaging, temporarily decreasing operational productivity.

### Remediation

- **Network & Domain Controls:**
  - Block C2 IP addresses (`46.8.238.240`, `23.94.225.177`) and associated domains (`tidyme.io`, `voico.io`) at the firewalls, DNS resolvers, and web proxies.
  - Monitor or restrict direct downloads of executable files from cloud hosting platforms like Dropbox on corporate endpoints.
- **Endpoint & Malware Detection:**
  - Perform emergency antivirus/EDR scans across all corporate workstations using updated YARA signatures to isolate and remove samples matching MD5 hash `E5B8B2CF5B244500B22B665C87C11767`.
  - Re-image all infected or impacted workstations to ensure no secondary payloads (such as StealC or Danabot) persist.
- **Identity & Access Management:**
  - Immediately rotate all user passwords and revoke active session cookies across all company accounts accessed on affected machines.
  - Require FIDO2/Hardware-based Multi-Factor Authentication (MFA) to prevent session hijacking and phishing attacks from granting full account access.
- **Cryptocurrency & Wallet Safeguards:**
  - Migrate all corporate treasury funds to newly created, cold-storage hardware wallets or multi-signature (multisig) vault accounts.
  - Discontinue the use of single-key browser extension wallets for managing organizational or DAO assets.
- **Security Awareness Training:**
  - Conduct targeted anti-phishing training focusing on typosquatted domains (e.g., verifying URLs like `peerme.io` vs `tidyme.io` before interacting or connecting wallets).
