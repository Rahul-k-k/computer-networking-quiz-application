// Single source of truth for seed data. Imported by BOTH the boot-time
// auto-seed (seeder/index.js, skipped if data already exists) and the CLI
// reset (seed.js, force). Never duplicated anywhere else.

/**
 * Build a self-contained inline SVG data URI usable directly as an <img src>.
 * encodeURIComponent keeps '#', '<', '>', quotes and spaces safe in the URI.
 */
function svg(body) {
  const doc =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 160' width='240' height='160'>" +
    "<rect width='240' height='160' rx='14' fill='#F4F1FF'/>" +
    body +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(doc);
}

// --- Hardware illustrations (used by the "identify this device" questions) ---

const IMG = {
  router: svg(
    "<g stroke='#5b4b8a' stroke-width='3' fill='none' stroke-linecap='round'>" +
      "<line x1='80' y1='70' x2='70' y2='34'/><line x1='120' y1='66' x2='120' y2='30'/><line x1='160' y1='70' x2='170' y2='34'/>" +
      "<circle cx='70' cy='30' r='4' fill='#FDBCB4' stroke='none'/><circle cx='120' cy='26' r='4' fill='#FDBCB4' stroke='none'/><circle cx='170' cy='30' r='4' fill='#FDBCB4' stroke='none'/></g>" +
      "<rect x='54' y='70' width='132' height='46' rx='12' fill='#ADD8E6'/>" +
      "<circle cx='76' cy='93' r='6' fill='#98FF98'/><circle cx='96' cy='93' r='6' fill='#98FF98'/>" +
      "<rect x='120' y='88' width='52' height='10' rx='5' fill='#ffffff' opacity='0.7'/>"
  ),
  switch: svg(
    "<rect x='30' y='58' width='180' height='44' rx='10' fill='#98FF98'/>" +
      "<g fill='#3f6f3f'>" +
      Array.from({ length: 8 }, (_, i) => `<rect x='${44 + i * 20}' y='74' width='12' height='14' rx='2'/>`).join('') +
      '</g>' +
      "<circle cx='40' cy='68' r='4' fill='#3f6f3f'/>"
  ),
  hub: svg(
    "<rect x='48' y='60' width='144' height='40' rx='10' fill='#FDBCB4'/>" +
      "<g fill='#8a4b3f'><rect x='66' y='74' width='12' height='12' rx='2'/><rect x='96' y='74' width='12' height='12' rx='2'/><rect x='126' y='74' width='12' height='12' rx='2'/><rect x='156' y='74' width='12' height='12' rx='2'/></g>" +
      "<text x='120' y='120' font-family='sans-serif' font-size='16' fill='#8a4b3f' text-anchor='middle'>HUB</text>"
  ),
  accessPoint: svg(
    "<circle cx='120' cy='104' r='30' fill='#ADD8E6'/>" +
      "<circle cx='120' cy='104' r='7' fill='#ffffff'/>" +
      "<g stroke='#4a7c93' stroke-width='4' fill='none' stroke-linecap='round'>" +
      "<path d='M96 62 q24 -22 48 0'/><path d='M84 48 q36 -34 72 0'/></g>"
  ),
  modem: svg(
    "<rect x='58' y='60' width='124' height='48' rx='10' fill='#c9b8ff'/>" +
      "<circle cx='80' cy='84' r='6' fill='#98FF98'/><circle cx='100' cy='84' r='6' fill='#FDBCB4'/><circle cx='120' cy='84' r='6' fill='#ADD8E6'/>" +
      "<rect x='140' y='78' width='30' height='12' rx='3' fill='#ffffff' opacity='0.8'/>"
  ),
};

// --- Demo accounts (known credentials, surfaced on the login screen) ---

const DEMO_TEACHER = {
  name: 'Professor Nova',
  email: 'teacher@speednet.dev',
  password: 'teach1234',
  role: 'teacher',
};

const DEMO_STUDENT = {
  name: 'Demo Student',
  email: 'student@speednet.dev',
  password: 'learn1234',
  role: 'student',
};

// --- Categories and their questions ---

const categories = [
  {
    name: 'Network Devices',
    description: 'Identify common networking hardware and know what each does.',
    durationMinutes: 6,
    passPercentage: 60,
    questions: [
      {
        type: 'mcq',
        text: 'Which device is shown here? (Hint: it forwards packets between different networks and often has antennas.)',
        options: ['Router', 'Unmanaged Hub', 'Patch Panel', 'Network Switch'],
        correctAnswer: 'Router',
        explanation:
          'A router forwards packets between separate networks (e.g. your LAN and the internet) using IP addresses, and wireless routers add antennas for Wi-Fi.',
        imageUrl: IMG.router,
      },
      {
        type: 'mcq',
        text: 'Identify this device: it connects many wired devices on the same LAN and forwards frames only to the correct port.',
        options: ['Network Switch', 'Router', 'Modem', 'Repeater'],
        correctAnswer: 'Network Switch',
        explanation:
          'A switch operates at Layer 2 and uses MAC addresses to forward frames only to the intended port, unlike a hub which floods every port.',
        imageUrl: IMG.switch,
      },
      {
        type: 'mcq',
        text: 'Which legacy device does this represent — it repeats incoming signals out of every other port with no filtering?',
        options: ['Hub', 'Switch', 'Firewall', 'Load Balancer'],
        correctAnswer: 'Hub',
        explanation:
          'A hub is a "dumb" Layer 1 device: it broadcasts everything it receives to all ports, causing collisions. Switches have largely replaced hubs.',
        imageUrl: IMG.hub,
      },
      {
        type: 'mcq',
        text: 'What is this device that lets Wi-Fi clients join a wired network?',
        options: ['Wireless Access Point', 'Router', 'Bridge', 'Gateway'],
        correctAnswer: 'Wireless Access Point',
        explanation:
          'A wireless access point (AP) bridges wireless clients onto a wired LAN. It is not necessarily a router — many APs do no routing at all.',
        imageUrl: IMG.accessPoint,
      },
      {
        type: 'mcq',
        text: 'Identify this device that modulates/demodulates signals to connect you to your ISP.',
        options: ['Modem', 'Switch', 'Access Point', 'Hub'],
        correctAnswer: 'Modem',
        explanation:
          'A modem (modulator-demodulator) converts between your ISP’s signal (cable/DSL/fiber) and the digital Ethernet your devices understand.',
        imageUrl: IMG.modem,
      },
    ],
  },
  {
    name: 'OSI & TCP/IP Model',
    description: 'Layers, their order, and what lives where.',
    durationMinutes: 6,
    passPercentage: 60,
    questions: [
      {
        type: 'mcq',
        text: 'How many layers does the OSI model have?',
        options: ['7', '5', '4', '6'],
        correctAnswer: '7',
        explanation: 'The OSI model has 7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application.',
      },
      {
        type: 'mcq',
        text: 'At which OSI layer does a router primarily operate?',
        options: ['Layer 3 (Network)', 'Layer 2 (Data Link)', 'Layer 4 (Transport)', 'Layer 1 (Physical)'],
        correctAnswer: 'Layer 3 (Network)',
        explanation: 'Routers make forwarding decisions based on IP addresses, which live at Layer 3, the Network layer.',
      },
      {
        type: 'mcq',
        text: 'Which layer is responsible for reliable, ordered delivery using TCP?',
        options: ['Transport', 'Network', 'Session', 'Data Link'],
        correctAnswer: 'Transport',
        explanation: 'TCP is a Transport-layer (Layer 4) protocol providing reliable, ordered, error-checked delivery.',
      },
      {
        type: 'mcq',
        text: 'In the TCP/IP model, which single layer roughly combines the OSI Application, Presentation, and Session layers?',
        options: ['Application', 'Transport', 'Internet', 'Link'],
        correctAnswer: 'Application',
        explanation: 'The 4-layer TCP/IP model collapses OSI layers 5–7 into a single Application layer.',
      },
      {
        type: 'mcq',
        text: 'A MAC address is used at which OSI layer?',
        options: ['Layer 2 (Data Link)', 'Layer 3 (Network)', 'Layer 1 (Physical)', 'Layer 4 (Transport)'],
        correctAnswer: 'Layer 2 (Data Link)',
        explanation: 'MAC addresses identify hardware on a local segment at the Data Link layer (Layer 2).',
      },
    ],
  },
  {
    name: 'Protocols & Ports',
    description: 'Well-known ports and the protocols that ride on them.',
    durationMinutes: 6,
    passPercentage: 60,
    questions: [
      {
        type: 'mcq',
        text: 'Which port does HTTPS use by default?',
        options: ['443', '80', '22', '3389'],
        correctAnswer: '443',
        explanation: 'HTTPS (HTTP over TLS) uses TCP port 443 by default; plain HTTP uses 80.',
      },
      {
        type: 'mcq',
        text: 'Which protocol resolves domain names to IP addresses?',
        options: ['DNS', 'DHCP', 'FTP', 'SMTP'],
        correctAnswer: 'DNS',
        explanation: 'DNS (Domain Name System) translates human-friendly names like example.com into IP addresses.',
      },
      {
        type: 'mcq',
        text: 'Which protocol automatically assigns IP addresses to hosts on a network?',
        options: ['DHCP', 'DNS', 'ARP', 'ICMP'],
        correctAnswer: 'DHCP',
        explanation: 'DHCP (Dynamic Host Configuration Protocol) leases IP configuration to clients automatically.',
      },
      {
        type: 'mcq',
        text: 'SSH, used for secure remote shells, listens on which default port?',
        options: ['22', '23', '21', '25'],
        correctAnswer: '22',
        explanation: 'SSH uses TCP port 22. Telnet (insecure) uses 23.',
      },
      {
        type: 'mcq',
        text: 'Which transport protocol is connectionless and does not guarantee delivery?',
        options: ['UDP', 'TCP', 'HTTP', 'TLS'],
        correctAnswer: 'UDP',
        explanation: 'UDP is connectionless and best-effort — no handshakes, ordering, or delivery guarantees, which makes it fast for streaming/DNS.',
      },
    ],
  },
  {
    name: 'IP Addressing',
    description: 'Classes, subnet masks, and address types — answered in your own words.',
    durationMinutes: 8,
    passPercentage: 60,
    questions: [
      {
        type: 'free-text',
        text: 'What class is the IPv4 address 192.168.1.10? (Answer with the class letter, e.g. "Class C".)',
        correctAnswer: 'Class C',
        explanation: 'Addresses from 192.0.0.0 to 223.255.255.255 are Class C. 192.168.x.x is a private Class C range.',
      },
      {
        type: 'free-text',
        text: 'What is the default subnet mask for a Class C network?',
        correctAnswer: '255.255.255.0',
        explanation: 'A Class C network uses a /24 prefix, i.e. 255.255.255.0, leaving 254 usable host addresses.',
      },
      {
        type: 'free-text',
        text: 'What is the loopback IPv4 address that always refers to the local machine?',
        correctAnswer: '127.0.0.1',
        explanation: '127.0.0.1 is the standard IPv4 loopback address (the whole 127.0.0.0/8 block is reserved for loopback).',
      },
      {
        type: 'free-text',
        text: 'In CIDR notation, how many usable host addresses are in a /24 network? (Give the number.)',
        correctAnswer: '254',
        explanation: 'A /24 has 256 total addresses; subtracting the network and broadcast addresses leaves 254 usable hosts.',
      },
      {
        type: 'free-text',
        text: 'What do we call an IP address that is routable on the public internet (as opposed to a private/reserved one)?',
        correctAnswer: 'Public IP address',
        explanation: 'A public IP address is globally routable on the internet, unlike private ranges (10/8, 172.16/12, 192.168/16) defined by RFC 1918.',
      },
    ],
  },
  {
    name: 'Network Security Basics',
    description: 'Core defensive concepts every networker should know.',
    durationMinutes: 6,
    passPercentage: 60,
    questions: [
      {
        type: 'mcq',
        text: 'Which device or software filters traffic based on a set of security rules?',
        options: ['Firewall', 'Switch', 'Repeater', 'Hub'],
        correctAnswer: 'Firewall',
        explanation: 'A firewall enforces rules about which traffic may pass between networks or hosts.',
      },
      {
        type: 'mcq',
        text: 'What does a VPN primarily provide?',
        options: ['An encrypted tunnel over an untrusted network', 'Faster raw bandwidth', 'Automatic IP assignment', 'Name resolution'],
        correctAnswer: 'An encrypted tunnel over an untrusted network',
        explanation: 'A VPN creates an encrypted tunnel so traffic can traverse untrusted networks (like the public internet) privately.',
      },
      {
        type: 'mcq',
        text: 'Flooding a target with traffic so legitimate users cannot connect is which kind of attack?',
        options: ['Denial of Service (DoS)', 'Phishing', 'SQL Injection', 'Man-in-the-middle'],
        correctAnswer: 'Denial of Service (DoS)',
        explanation: 'A DoS (or distributed DDoS) attack overwhelms a service with traffic to make it unavailable.',
      },
      {
        type: 'mcq',
        text: 'Which of these makes web traffic confidential and tamper-evident?',
        options: ['TLS/SSL', 'ARP', 'ICMP', 'NAT'],
        correctAnswer: 'TLS/SSL',
        explanation: 'TLS (formerly SSL) encrypts and authenticates traffic — it is what puts the "S" in HTTPS.',
      },
    ],
  },
];

// Tag every seeded question with a difficulty in a repeating low/medium/high
// cycle per category, so each category is immediately playable at every level
// (students choose a difficulty when they start a quiz). Explicit difficulty on
// a question, if ever set above, is preserved.
const DIFFICULTY_CYCLE = ['low', 'medium', 'high'];
for (const cat of categories) {
  cat.questions.forEach((q, i) => {
    if (!q.difficulty) q.difficulty = DIFFICULTY_CYCLE[i % DIFFICULTY_CYCLE.length];
  });
}

module.exports = { categories, DEMO_TEACHER, DEMO_STUDENT, IMG };
