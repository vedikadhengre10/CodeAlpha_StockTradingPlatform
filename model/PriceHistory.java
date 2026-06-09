

package model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Immutable record of a stock price at a specific point in time
 */
public class PriceHistory {
    private final double price;
    private final LocalDateTime timestamp;
    private static final DateTimeFormatter FORMATTER =
        DateTimeFormatter.ofPattern("HH:mm:ss");

    public PriceHistory(double price, LocalDateTime timestamp) {
        this.price = price;
        this.timestamp = timestamp;
    }

    public double getPrice() { return price; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public String getFormattedTime() { return timestamp.format(FORMATTER); }
}
