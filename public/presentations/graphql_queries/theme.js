const white = '#fffceb'
const black = '#11111f'
const blue = '#2d5dd7'

const sdBG = '#073642';
const sdText = '#93a1a1';
const sdLink = '#dc322f';

const slBG = '#fdf6e3';
const slText = '073642';
const slLink = '#268bd2';

// const colors = {
//   background: sdBG,
//   text: slBG,
//   link: sdLink
// };

const colors = {
  background: slBG,
  text: slText,
  link: slLink
};

export default {
  fonts: {
    body: '"Open Sans", sans-serif',
  },
  googleFont: 'https://fonts.googleapis.com/css?family=Open+Sans',
  colors,
  fontSizes: [
  //b        6   5   4   3  h2+code  h1
    12, 14, 18, 20, 20, 24, 28, 36
  ],
  styles: {
    root: {
      textAlign: 'left',
      code: {
        background: colors.background
      }
    },
    pre: {
      background: colors.background,
      code: {
        background: colors.background
      }
    },
    code: {
      background: colors.background
    },
    Slide: {
      display: 'block',
      padding: '2em',
      textAlign: 'left',
    },
  },
}
