import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <p className={styles.disclaimer}>
                    This is an experimental governance tool. Votes are non-binding.
                </p>
                <p className={styles.copyright}>
                    &copy; {new Date().getFullYear()} Snow Riu DAO
                </p>
            </div>
        </footer>
    );
}
