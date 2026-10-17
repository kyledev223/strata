/**
 * PLACEHOLDER program IDs. These are freshly generated keys with nothing
 * deployed at them. Replace with the real IDs from `anchor deploy` in phase 2.
 */
export const PROGRAMS = {
  launchpad: "3sxbS4zXK237x7KdE8tVjKdnCPo6tz9gxpEogrHwUaE9",
  reserve: "E2RnrLoU4oWH9AXDZUY4R7E9zacv9kfBB3KuGKAmujha",
  redemption: "GLesBSVnhzj5geuXEDfPKgeHdD1jZy7aSRNHwDCftMXf",
  fees: "HqvDEnBNW8mMiAQMKDAPP6j2w4Pvsk9wfCYmg4ChFQCA",
} as const;

export const PROGRAM_LIST: { name: string; address: string }[] = [
  { name: "Launch curve", address: PROGRAMS.launchpad },
  { name: "Reserve vault", address: PROGRAMS.reserve },
  { name: "Redemption", address: PROGRAMS.redemption },
  { name: "Fee router", address: PROGRAMS.fees },
];

/** PLACEHOLDER social links until the real accounts are set. */
export const LINKS = {
  github: "https://github.com/",
  x: "https://x.com/",
} as const;

/** A bare github.com / x.com URL is still the placeholder, so the UI hides it. */
export const isRealLink = (url: string) => !/^https:\/\/(github|x)\.com\/?$/.test(url);
