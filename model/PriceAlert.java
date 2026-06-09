

package model;

/**
 * Represents a price alert set by a user for a specific stock
 */
public class PriceAlert {
    public enum AlertType { ABOVE, BELOW }
    public enum AlertStatus { ACTIVE, TRIGGERED, CANCELLED }

    private final String alertId;
    private final String userId;
    private final String symbol;
    private final AlertType alertType;
    private final double targetPrice;
    private AlertStatus status;
    private String message;

    public PriceAlert(String alertId, String userId, String symbol,
                      AlertType alertType, double targetPrice) {
        this.alertId = alertId;
        this.userId = userId;
        this.symbol = symbol;
        this.alertType = alertType;
        this.targetPrice = targetPrice;
        this.status = AlertStatus.ACTIVE;
    }

    public boolean shouldTrigger(double currentPrice) {
        if (status != AlertStatus.ACTIVE) return false;
        return switch (alertType) {
            case ABOVE -> currentPrice >= targetPrice;
            case BELOW -> currentPrice <= targetPrice;
        };
    }

    public void trigger(double currentPrice) {
        this.status = AlertStatus.TRIGGERED;
        this.message = String.format("ALERT: %s hit $%.2f (target: $%.2f %s)",
            symbol, currentPrice, targetPrice,
            alertType == AlertType.ABOVE ? "▲" : "▼");
    }

    public String getAlertId() { return alertId; }
    public String getUserId() { return userId; }
    public String getSymbol() { return symbol; }
    public AlertType getAlertType() { return alertType; }
    public double getTargetPrice() { return targetPrice; }
    public AlertStatus getStatus() { return status; }
    public void setStatus(AlertStatus status) { this.status = status; }
    public String getMessage() { return message; }

    @Override
    public String toString() {
        return String.format("Alert[%s %s $%.2f | %s]",
            symbol, alertType, targetPrice, status);
    }
}
