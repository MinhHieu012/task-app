import { Image } from 'react-native';

/** Google's own four-colour "G": the sign-in branding asks for it, not a one-colour glyph. One 144px image drawn
 *  small, so it stays sharp at any pixel density (web served the 1x file, which blurred on scaled screens). */
export const GoogleLogo = ({ size = 18 }: { size?: number }) => (
  <Image source={require('../../assets/google.png')} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
);
