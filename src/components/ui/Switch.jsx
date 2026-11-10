import MuiSwitch from "@mui/material/Switch";

/**
 * An on/off switch.
 *
 * A thin wrapper over Material UI's Switch, so every on/off control in the
 * app looks and behaves the same. The input carries `role="switch"`, so a
 * screen reader announces the state instead of leaving it to be guessed.
 *
 * The switch is `small` by default: it sits inside dense table rows and
 * form rows, where the full-size control would crowd the row.
 *
 * The brand colour is applied with `sx` rather than a theme provider on
 * purpose. A `ThemeProvider` around the app re-renders the whole tree when
 * the theme context appears, and the admin console — charts, tables, every
 * provider — pays for it on every load. One switch does not need that.
 */
const sx = {
  "& .MuiSwitch-switchBase.Mui-checked": { color: "#2874f0" },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#2874f0" },
};

export default function Switch({ size = "small", ...props }) {
  return <MuiSwitch size={size} sx={sx} {...props} />;
}
