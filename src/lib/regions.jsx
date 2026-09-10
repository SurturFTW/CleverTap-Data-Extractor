export const REGIONS = {
  eu: { label: "Europe (default)", host: "api.clevertap.com" },
  in: { label: "India", host: "in1.api.clevertap.com" },
  sg: { label: "Singapore", host: "sg1.api.clevertap.com" },
  us: { label: "United States", host: "us1.api.clevertap.com" },
  id: { label: "Indonesia", host: "aps3.api.clevertap.com" },
  me: { label: "Middle East (UAE)", host: "mec1.api.clevertap.com" },
};

export const REGION_OPTIONS = Object.entries(REGIONS).map(([value, r]) => ({
  value,
  label: r.label,
}));
