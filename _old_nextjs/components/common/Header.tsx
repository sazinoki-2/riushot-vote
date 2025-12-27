import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <Link href="/" className={styles.brand}>
                    Snow Riu DAO
                </Link>
                <div className={styles.actions}>
                    <button className={styles.connectButton}>
                        Connect Wallet
                    </button>
                </div>
            </div>
        </header>
    );
}
