import { Netmask } from "netmask";

// Gate inbound webhooks to an allowlisted CIDR range.
export const inBlock = (cidr: string, ip: string): boolean => new Netmask(cidr).contains(ip);
