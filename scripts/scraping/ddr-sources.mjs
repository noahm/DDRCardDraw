/*
 * Data defined in this file gives us a starting point for scraping.
 * Ziv is a mostly-reliable source of top level song lists, but foot ratings are not reliable
 * the remy links are discoverable from individual songs, but the top level mix page on remy
 * that is linked here is used to pull a list of removed songs that we can filter out.
 *
 * Obviously the filename does what it says.
 */

export const DDR_A3 = {
  remy: "https://remywiki.com/AC_DDR_A3",
  ziv: "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=5518&show_notecounts=1&sort=&sort_order=asc",
  mergeSkillAttack: true,
  filename: "a3.json",
  jacketPrefix: "",
  preferredJacketSource: "remy",
};

export const DDR_SN = {
  remy: "", // no removed songs to care about
  ziv: "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=238&show_notecounts=1&sort=&sort_order=asc",
  mergeSkillAttack: false, // modern difficulty scale will mess up the data
  filename: "ddr_sn.json",
  jacketPrefix: "ddr_sn/",
  preferredJacketSource: "ziv",
};
