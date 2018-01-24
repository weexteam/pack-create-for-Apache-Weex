const path = require('path');
const chalk = require('chalk');

const helper = (events, dir) => {
  const commandsWithDesc = [
    {
      name: 'npm start',
      desc: [
        'Starts the development server for you to preview your weex page on browser',
        'You can also scan the QR code using weex playground to preview weex page on native'
      ]
    },
    {
      name: 'npm run dev',
      desc: [
        'Open the code compilation task in watch mode'
      ]
    },
    {
      name: 'npm run ios',
      desc: [
        '(Mac only, requires Xcode)',
        'Starts the development server and loads your app in an iOS simulator'
      ]
    },
    {
      name: 'npm run android',
      desc: [
        '(Requires Android build tools)',
        'Starts the development server and loads your app on a connected Android device or emulator'
      ]
    },
    {
      name: 'npm run pack:ios',
      desc: [
        '(Mac only, requires Xcode)',
        'Packaging ios project into ipa package'
      ]
    },
    {
      name: 'npm run pack:android',
      desc: [
        '(Requires Android build tools)',
        'Packaging android project into apk package'
      ]
    },
    {
      name: 'npm run pack:web',
      desc: [
        'Packaging html5 project into `web/build` folder'
      ]
    },
    {
      name: 'npm run test',
      desc: [
        'Starts the test runner'
      ]
    }
  ];
  events.emit('log', `\n${chalk.green(`Success! Created ${path.basename(dir)} at ${dir}`)}`);
  events.emit('log', '\nInside that directory, you can run several commands:\n');
  commandsWithDesc.forEach(c => {
    events.emit('log', `\n  ${chalk.yellow(c.name)}`);
    c.desc.forEach(d => {
      events.emit('log', `  ${d}`);
    });
  });

  events.emit('log', `\nTo get started:\n`);
  events.emit('log', chalk.yellow(`  cd ${path.basename(dir)}`));
  events.emit('log', chalk.yellow(`  npm start`));
  events.emit('log', `\nEnjoy your hacking time!`);
};

module.exports = helper;
