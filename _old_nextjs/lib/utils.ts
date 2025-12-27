import { differenceInHours, differenceInDays, parseISO } from 'date-fns';

export function getTimeRemaining(endTime: string): string {
    const end = parseISO(endTime);
    const now = new Date();

    if (now > end) return 'Closed';

    const days = differenceInDays(end, now);
    const hours = differenceInHours(end, now) % 24;

    if (days > 0) {
        return `${days}d ${hours}h left`;
    }
    return `${hours}h left`;
}

export function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
