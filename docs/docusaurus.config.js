// @ts-check
// Docusaurus configuration for Friendly AI AEP Tool Documentation
// This is a placeholder configuration. Install @docusaurus/core and related packages to use.

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Friendly AI AEP Tool',
  tagline: 'Agent Execution Platform - Build, Deploy, and Manage AI Agents',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://docs.friendly-aep.example.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'friendly-tech',
  projectName: 'friendly-aiaep',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/friendly-tech/friendly-aiaep/tree/main/docs/',
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/friendly-tech/friendly-aiaep/tree/main/docs/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Friendly AI AEP',
        logo: {
          alt: 'Friendly AI AEP Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          { to: '/blog', label: 'Blog', position: 'left' },
          {
            href: 'https://github.com/friendly-tech/friendly-aiaep',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/intro',
              },
              {
                label: 'API Reference',
                to: '/docs/api',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/friendly-aep',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/friendly_aep',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/friendly-tech/friendly-aiaep',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Friendly Technology. Built with Docusaurus.`,
      },
      prism: {
        theme: require('prism-react-renderer').themes.github,
        darkTheme: require('prism-react-renderer').themes.dracula,
      },
    }),
};

export default config;
