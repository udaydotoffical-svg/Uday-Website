/*
 * ALL site text and links live here. Layout code never needs touching.
 *
 * To add a project: copy one object in `projects.items`, change the fields, done.
 * Projects alternate left/right automatically.
 *
 * visual.type:
 *   'browser' -> fake browser window with a live <iframe> (set embed:false to show only the fallback image)
 *   'media'   -> image, or a video if `video` is set
 */
window.SITE = {
  name: 'Uday Singh',
  tagline: 'I build hardware that talks to software',
  eyebrow: 'Student dev · Vadodara, India',
  description:
    'Uday Singh is a student developer and hardware builder from Vadodara, India, focused on firmware and hardware. WRO 2026 Future Innovators, team CultureWear.',
  siteUrl: 'https://uday-singh.vercel.app', // PLACEHOLDER: set to your real domain (used for Open Graph)

  links: {
    github: 'https://github.com/udaydotoffical-svg',
    email: 'uday.dot.offical@gmail.com',
    instagram: 'https://instagram.com/uday.dot.official',
    instagramHandle: '@uday.dot.official',
  },

  nav: [
    { label: 'about', href: '#about' },
    { label: 'projects', href: '#projects' },
    { label: 'timeline', href: '#timeline' },
    { label: 'contact', href: '#contact' },
  ],

  about: {
    title: 'About',
    paragraphs: [
      "I'm Uday, a student developer from Vadodara, India, with a focus on firmware and hardware. My favourite part of any build is the moment a sensor reading turns into something you can see on a screen.",
      'In 2026 I competed at WRO Future Innovators with team CultureWear, where I was the primary firmware and hardware developer.',
    ],
    tags: ['Firmware', 'Hardware', 'Sensors', 'Student dev', 'WRO 2026'],
  },

  projects: {
    title: 'Projects',
    items: [
      {
        id: 'knowura',
        title: 'KNOWURA',
        kicker: 'Education AI app',
        description:
          'Knowura is an education AI app with a dark ocean-blue glass interface and a sidebar chat layout. Ask a question, learn the answer, and keep every conversation one click away.',
        tags: ['Education', 'AI', 'Chat UI', 'Glass UI', 'Vercel'],
        link: { label: 'Open Knowura', href: 'https://knowura.vercel.app' },
        visual: {
          type: 'browser',
          embed: true, // false = skip the iframe, show only the fallback image
          url: 'https://knowura.vercel.app',
          displayUrl: 'knowura.vercel.app',
          fallback: 'assets/knowura-fallback.svg', // PLACEHOLDER: swap for a real screenshot
          alt: 'Knowura app preview',
        },
      },
      {
        id: 'samata',
        title: 'SAMATA',
        kicker: 'Wearable EEG + IMU headband',
        description:
          'Samata is a wearable headband that reads EEG and IMU signals, built for WRO Nationals. Brain activity and head motion are picked up by the sensors and handled by custom firmware.',
        tags: ['EEG', 'IMU', 'Firmware', 'Wearable', 'WRO Nationals'],
        link: { label: 'View Samata', href: 'https://github.com/udaydotoffical-svg' }, // PLACEHOLDER: point at the Samata repo or write-up
        visual: {
          type: 'media',
          image: 'assets/samata-placeholder.svg', // PLACEHOLDER: swap for your photo
          video: '', // optional: e.g. 'assets/samata-demo.mp4' (plays muted on loop)
          alt: 'Samata EEG and IMU headband',
        },
      },
    ],
  },

  timeline: {
    title: 'Timeline',
    items: [
      {
        when: '2026',
        title: 'WRO 2026 · Future Innovators',
        text: 'Competed with team CultureWear as primary firmware and hardware developer.',
      },
      {
        when: '2026',
        title: 'WRO Nationals · Samata',
        text: 'Built Samata, a wearable EEG and IMU headband, for WRO Nationals.',
      },
      {
        when: 'Now',
        title: 'Knowura',
        text: 'Building and shipping the education AI app.',
      },
      {
        when: 'Now',
        title: 'Samata',
        text: 'Still building on the headband hardware and firmware.',
      },
    ],
  },

  quotes: {
    title: 'Words I live by',
    items: [
      "The indomitable human spirit is the one that doesn't fear failure but embraces it like an old friend",
      "Failure is just success in a cloak. Impress it and it will show it's real identity.",
    ],
  },

  contact: {
    title: 'Contact',
    intro: 'Got a build, a bug, or an idea? Send it over.',
    formspreeId: '', // optional: paste a Formspree form id (e.g. 'xyzabcde'). Empty = the form opens your email app instead.
    subject: 'Hello from your portfolio',
  },

  footer: 'Built by Uday Singh · Vadodara, India',
};
