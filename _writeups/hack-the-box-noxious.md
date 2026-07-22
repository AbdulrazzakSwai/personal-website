---
title: "Hack The Box: Noxious"
date: 2025-12-03
summary: "A Very Easy Windows-based defensive lab analyzing a network packet capture to investigate an internal LLMNR poisoning attack. Wireshark analysis isolates the rogue machine's IP and DHCP hostname, identifies a mistyped file share string that triggered LLMNR broadcasting, reconstructs NTLMv2 challenge-response components to recover cleartext credentials via John the Ripper, and identifies the intended destination share."
platform: "Hack The Box"
type: "Defensive Lab"
os: "Windows"
difficulty: "Very Easy"
link: "https://app.hackthebox.com/sherlocks/Noxious"
tags:
  - active-directory
  - dfir
  - john
  - llmnr-poisoning
  - wireshark
---

### Executive Summary

The incident involves an LLMNR poisoning attack inside the AD network. A rogue device replied to the victim workstation’s LLMNR broadcasts and captured the victim’s NTLMv2 hash. The hash was cracked, giving the attacker the user’s real password. The attack began after the user mistyped a file share name, and the rogue host kept answering LLMNR requests from the victim.

### Scenario

The IDS device alerted us to a possible rogue device in the internal Active Directory network. The Intrusion Detection System also indicated signs of LLMNR traffic, which is unusual. It is suspected that an LLMNR poisoning attack occurred. The LLMNR traffic was directed towards Forela-WKstn002, which has the IP address 172.17.79.136. A limited packet capture from the surrounding time is provided to you, our Network Forensics expert. Since this occurred in the Active Directory VLAN, it is suggested that we perform network threat hunting with the Active Directory attack vector in mind, specifically focusing on LLMNR poisoning.

### Provided Artifacts

A ZIP archive, `noxious.zip`, containing a packet capture file.

### Task 1

***Question: Its suspected by the security team that there was a rogue device in Forela's internal network running responder tool to perform an LLMNR Poisoning attack. Please find the malicious IP Address of the machine.***

Let’s start by launching `wireshark` and importing the given pcap file into it.

Since the targeted IP is 172.17.79.136 and the attack involves LLMNR poisoning, let’s use this filter:

```bash
llmnr and ip.dst == 172.17.79.136
```

All the resulted packets are coming from the same IP:

![Figure 1](/assets/images/writeups/hack-the-box-noxious/hack-the-box-noxious-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

***Answer: 172.17.79.&lt;REDACTED&gt;***

### Task 2

***Question: What is the hostname of the rogue machine?***

Hostnames are communicated in DHCP communications so that the host maps its hostname to IP, so let’s filter for DHCP packets where the malicious IP is the sender (requestor):

![Figure 2](/assets/images/writeups/hack-the-box-noxious/hack-the-box-noxious-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

After checking the packet details, the hostname is mentioned under Host Name.

***Answer: ka&lt;REDACTED&gt;***

### Task 3

***Question: Now we need to confirm whether the attacker captured the user's hash and it is crackable!! What is the username whose hash was captured?***

In LLMNR poisoning attacks, after sending rouge LLMNR packets the victim tries to authenticate to the attacker, and the NTLM hash is sent during the authentication process. This process happens over SMB2 (SMB1 is disabled by default in modern systems).

Given this fact, let’s filter for SMB2 packets. Specifically, let’s filter for SMB2 packets that involve NTLM authentication, which is handled by NTLMSSP:

```bash
smb2 && ntlmssp
```

![Figure 3](/assets/images/writeups/hack-the-box-noxious/hack-the-box-noxious-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

All filtered packets show the username in their details.

***Answer: John.&lt;REDACTED&gt;***

### Task 4

***Question: In NTLM traffic we can see that the victim credentials were relayed multiple times to the attacker's machine. When were the hashes captured the First time?***

First let’s set the time in UTC format from View → Time Display Format → UTC Date and Time.

Then, in the same filtered output, let’s check the first authentication process which happened in the first three packets combined and represents the first relay attack:

![Figure 4](/assets/images/writeups/hack-the-box-noxious/hack-the-box-noxious-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

***Answer: 2024-06-24 11:18:&lt;REDACTED&gt;***

### Task 5

***Question: What was the typo made by the victim when navigating to the file share that caused his credentials to be leaked?***

LLMNR will take place instead of DNS when DNS fails to identify the file share name that is being queried. So, the share name can be found in LLMNR packets that originated from the victim. Let’s filter for that:

```bash
llmnr and ip.src == 172.17.79.136
```

After doing so and by checking almost any of the packets’ details, the misspelled share name can be identified:

![Figure 5](/assets/images/writeups/hack-the-box-noxious/hack-the-box-noxious-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

***Answer: DCC&lt;REDACTED&gt;***

### Task 6

***Question: To get the actual credentials of the victim user we need to stitch together multiple values from the ntlm negotiation packets. What is the NTLM server challenge value?***

Let’s get back to the SBM2 and NTLMSSP filter and look into NTLMSSP_CHALLENGE packets.

After diving deep into Packet details → SMB2 → Session Setup Response → Security Blob → GSS-API → Simple Protection Negotiation → negTokenTarg → NTLM Secure System Provider, we can identify the NTLM server challenge value:

![Figure 6](/assets/images/writeups/hack-the-box-noxious/hack-the-box-noxious-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

***Answer: 6010&lt;REDACTED&gt;***

### Task 7

***Question: Now doing something similar find the NTProofStr value.***

This value should be traced in authentication packets, so let’s find it in them.

After following this path, the value is identified: SMB2 → Security Blob → GSS-API → Simple Protected Negotiation → NTLM Secure Service Provider → NTLM Response → NTLMV2 Response

![Figure 7](/assets/images/writeups/hack-the-box-noxious/hack-the-box-noxious-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

### Task 8

***Question: To test the password complexity, try recovering the password from the information found from packet capture. This is a crucial step as this way we can find whether the attacker was able to crack this and how quickly.***

To attempt cracking the hash, let’s use `john`. The following details are required:

- Username
- Domain
- Server Challenge
- NTProofStr
- NTLMv2 Response Without First 16 Bytes (because they represent the NTProofStr)

We have all of those values (Domain value is FORELA from figure 3, and NTLMv2 Response is found in figure 7).

Let’s put them in the format that `john` accepts and attempt to crack the hash:

```bash
User::Domain:ServerChallenge:NTProofStr:NTLMv2ResponseWithoutFirst16Bytes
```

```bash
$ echo 'john.<REDACTED>::FORELA:6010<REDACTED>:c0cc<REDACTED>:01010000<REDACTED>' > ntlmv2.hash
                                                                                                                                                                                                                                             
$ john ntlmv2.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
NotM<REDACTED> (john.<REDACTED>)     
<SNIP>
```

***Answer: NotM&lt;REDACTED&gt;***

### Task 9

***Question: Just to get more context surrounding the incident, what is the actual file share that the victim was trying to navigate to?***

Assuming that the victim corrected his typo mistake and accessed the correct share name, let’s filter for SMB2 traffic coming from the target’s IP:

```bash
smb2 and ip.src == 172.17.79.136
```

There is one non-default share found in the packets:

![Figure 8](/assets/images/writeups/hack-the-box-noxious/hack-the-box-noxious-fig-9.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

***Answer: \\DC&lt;REDACTED&gt;\DC-Co&lt;REDACTED&gt;***

---

## Business Impact

### Confidentiality

- The user’s NTLMv2 hash and password were exposed.
- The attacker could log in as that user.
- Sensitive files or internal systems could be accessed.

### Integrity

- Stolen credentials allow changes to files and internal data.

### Availability

- Misuse of the stolen account could disturb normal operations.

## Remediation

- Block and remove the rogue device from the network.
- Reset the victim user’s password and check for password reuse.
- Disable LLMNR using Group Policy.
- Enable SMB signing and limit NTLM where possible.
- Add alerts for unusual LLMNR replies and repeated NTLM capture attempts.
- Teach users to double check file share names to avoid accidental LLMNR triggers.
