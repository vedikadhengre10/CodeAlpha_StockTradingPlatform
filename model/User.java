

package model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * Represents a trading platform user with portfolio and account management
 */
public class User {
    private final String userId;
    private final String username;
    private String passwordHash;
    private String email;
    private double cashBalance;
    private double initialDeposit;
    private final Portfolio portfolio;
    private final LocalDateTime registeredAt;
    private LocalDateTime lastLogin;
    private UserTier tier;
    private int totalTrades;
    private double totalProfit;
    private double totalLoss;
    private boolean isActive;

    public enum UserTier {
        BRONZE("Bronze", 0),
        SILVER("Silver", 10),
        GOLD("Gold", 50),
        PLATINUM("Platinum", 200);

        private final String label;
        private final int minTrades;

        UserTier(String label, int minTrades) {
            this.label = label;
            this.minTrades = minTrades;
        }
        public String getLabel() { return label; }
        public int getMinTrades() { return minTrades; }
    }

    public User(String userId, String username, String passwordHash,
                String email, double initialDeposit) {
        this.userId = userId;
        this.username = username;
        this.passwordHash = passwordHash;
        this.email = email;
        this.cashBalance = initialDeposit;
        this.initialDeposit = initialDeposit;
        this.portfolio = new Portfolio(userId);
        this.registeredAt = LocalDateTime.now();
        this.lastLogin = LocalDateTime.now();
        this.tier = UserTier.BRONZE;
        this.totalTrades = 0;
        this.totalProfit = 0;
        this.totalLoss = 0;
        this.isActive = true;
    }

    public void deposit(double amount) {
        if (amount < 10.0) throw new IllegalArgumentException("Deposit must be at least $10.00");
        if (amount > 10000000.0) throw new IllegalArgumentException("Deposit cannot exceed $10,000,000.00");
        cashBalance += amount;
        initialDeposit += amount;
    }

    public void withdraw(double amount) {
        if (amount < 10.0) throw new IllegalArgumentException("Withdrawal must be at least $10.00");
        if (amount > 5000000.0) throw new IllegalArgumentException("Withdrawal cannot exceed $5,000,000.00");
        if (amount > cashBalance) throw new IllegalStateException("Insufficient funds");
        cashBalance -= amount;
        initialDeposit -= amount; // reduce capital basis for accurate net return P&L
    }

    public void deductCash(double amount) {
        if (amount > cashBalance) throw new IllegalStateException("Insufficient funds");
        cashBalance -= amount;
    }

    public void addCash(double amount) {
        cashBalance += amount;
    }

    public void recordTrade(double profitOrLoss) {
        totalTrades++;
        if (profitOrLoss >= 0) totalProfit += profitOrLoss;
        else totalLoss += Math.abs(profitOrLoss);
        updateTier();
    }

    private void updateTier() {
        if (totalTrades >= UserTier.PLATINUM.getMinTrades()) tier = UserTier.PLATINUM;
        else if (totalTrades >= UserTier.GOLD.getMinTrades()) tier = UserTier.GOLD;
        else if (totalTrades >= UserTier.SILVER.getMinTrades()) tier = UserTier.SILVER;
        else tier = UserTier.BRONZE;
    }

    public double getNetProfitLoss() {
        return totalProfit - totalLoss;
    }

    public double getWinRate() {
        if (totalTrades == 0) return 0;
        return (totalProfit > 0) ? (totalProfit / (totalProfit + totalLoss)) * 100 : 0;
    }

    // Getters and setters
    public String getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String hash) { this.passwordHash = hash; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public double getCashBalance() { return cashBalance; }
    public double getInitialDeposit() { return initialDeposit; }
    public Portfolio getPortfolio() { return portfolio; }
    public LocalDateTime getRegisteredAt() { return registeredAt; }
    public LocalDateTime getLastLogin() { return lastLogin; }
    public void setLastLogin(LocalDateTime dt) { this.lastLogin = dt; }
    public UserTier getTier() { return tier; }
    public int getTotalTrades() { return totalTrades; }
    public double getTotalProfit() { return totalProfit; }
    public double getTotalLoss() { return totalLoss; }
    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { this.isActive = active; }

    @Override
    public String toString() {
        return String.format("User[%s | %s | %s Tier | Balance: $%.2f]",
            userId, username, tier.getLabel(), cashBalance);
    }
}
