

package service;

import model.*;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Handles file I/O operations for saving and loading portfolio/transaction data
 */
public class FileIOService {
    private static final String DATA_DIR = "trading_data";
    private static final String PORTFOLIO_DIR = DATA_DIR + "/portfolios";
    private static final String TRANSACTIONS_DIR = DATA_DIR + "/transactions";
    private static final String REPORTS_DIR = DATA_DIR + "/reports";
    private static final DateTimeFormatter FILE_DT_FMT =
        DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    public FileIOService() {
        createDirectories();
    }

    private void createDirectories() {
        try {
            Files.createDirectories(Paths.get(PORTFOLIO_DIR));
            Files.createDirectories(Paths.get(TRANSACTIONS_DIR));
            Files.createDirectories(Paths.get(REPORTS_DIR));
        } catch (IOException e) {
            System.err.println("Warning: Could not create data directories: " + e.getMessage());
        }
    }

    public void savePortfolio(User user, PortfolioService portfolioService,
                               MarketService marketService) throws IOException {
        String filename = PORTFOLIO_DIR + "/" + user.getUsername() + "_portfolio.txt";
        try (PrintWriter writer = new PrintWriter(new FileWriter(filename))) {
            writer.println("=== APEX TRADING — PORTFOLIO SNAPSHOT ===");
            writer.println("User: " + user.getUsername() + " (" + user.getUserId() + ")");
            writer.println("Tier: " + user.getTier().getLabel());
            writer.println("Saved: " + LocalDateTime.now().format(
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            writer.println();

            writer.println("--- ACCOUNT SUMMARY ---");
            writer.printf("Cash Balance:       $%,.2f%n", user.getCashBalance());
            writer.printf("Stock Value:        $%,.2f%n", portfolioService.getStockValue(user));
            writer.printf("Total Portfolio:    $%,.2f%n", portfolioService.getTotalPortfolioValue(user));
            writer.printf("Unrealized P&L:     $%,.2f (%.2f%%)%n",
                portfolioService.getUnrealizedPnL(user),
                portfolioService.getUnrealizedReturnPercent(user));
            writer.printf("Total Return:       %.2f%%%n",
                portfolioService.getTotalReturnPercent(user));
            writer.println();

            writer.println("--- HOLDINGS ---");
            writer.printf("%-8s %-25s %6s %10s %10s %12s %10s%n",
                "Symbol", "Company", "Qty", "Avg Cost", "Price", "Value", "P&L %");
            writer.println("-".repeat(85));

            List<PortfolioService.HoldingSnapshot> snapshots =
                portfolioService.getHoldingSnapshots(user);

            if (snapshots.isEmpty()) {
                writer.println("No holdings");
            } else {
                for (PortfolioService.HoldingSnapshot s : snapshots) {
                    writer.printf("%-8s %-25s %6d %10.2f %10.2f %12.2f %9.2f%%%n",
                        s.stock.getSymbol(),
                        truncate(s.stock.getCompanyName(), 24),
                        s.quantity, s.avgCost, s.currentPrice,
                        s.currentValue, s.unrealizedPnLPct);
                }
            }

            writer.println();
            writer.println("--- SECTOR ALLOCATION ---");
            Map<String, Double> sectors = portfolioService.getSectorAllocation(user);
            sectors.forEach((sector, pct) ->
                writer.printf("%-20s %.1f%%%n", sector, pct));
        }
        System.out.println("✓ Portfolio saved to: " + filename);
    }

    public void saveTransactionHistory(User user, TransactionService txService) throws IOException {
        String filename = TRANSACTIONS_DIR + "/" + user.getUsername() + "_transactions.csv";
        try (PrintWriter writer = new PrintWriter(new FileWriter(filename))) {
            writer.println("TxID,Timestamp,Type,OrderType,Symbol,Quantity,Price,Commission,Total,P&L");
            List<Transaction> txList = txService.getTransactionHistory(user.getUserId());
            for (Transaction tx : txList) {
                writer.printf("%s,%s,%s,%s,%s,%d,%.2f,%.2f,%.2f,%.2f%n",
                    tx.getTransactionId(), tx.getFormattedTimestamp(),
                    tx.getType(), tx.getOrderType(), tx.getSymbol(),
                    tx.getQuantity(), tx.getPricePerShare(),
                    tx.getCommission(), tx.getTotalAmount(),
                    tx.getProfitLoss());
            }
        }
        System.out.println("✓ Transaction history saved to: " + filename);
    }

    public void generateFullReport(User user, PortfolioService portfolioService,
                                    TransactionService txService,
                                    MarketService marketService) throws IOException {
        String timestamp = LocalDateTime.now().format(FILE_DT_FMT);
        String filename = REPORTS_DIR + "/" + user.getUsername() + "_report_" + timestamp + ".txt";

        try (PrintWriter writer = new PrintWriter(new FileWriter(filename))) {
            writer.println("╔══════════════════════════════════════════════════╗");
            writer.println("║       APEX TRADING — FULL PERFORMANCE REPORT      ║");
            writer.println("╚══════════════════════════════════════════════════╝");
            writer.println();
            writer.println("Generated: " + LocalDateTime.now().format(
                DateTimeFormatter.ofPattern("MMMM d, yyyy  HH:mm:ss")));
            writer.println("User: " + user.getUsername() + " | Tier: " + user.getTier().getLabel());
            writer.println("Member Since: " + user.getRegisteredAt().format(
                DateTimeFormatter.ofPattern("MMM d, yyyy")));
            writer.println();

            // Performance Stats
            writer.println("══════════════════════ PERFORMANCE ══════════════════════");
            writer.printf("Initial Deposit:     $%,.2f%n", user.getInitialDeposit());
            writer.printf("Current Cash:        $%,.2f%n", user.getCashBalance());
            writer.printf("Stock Holdings:      $%,.2f%n", portfolioService.getStockValue(user));
            writer.printf("Total Portfolio:     $%,.2f%n", portfolioService.getTotalPortfolioValue(user));
            writer.printf("Unrealized P&L:      $%,.2f%n", portfolioService.getUnrealizedPnL(user));
            writer.printf("Realized P&L:        $%,.2f%n", txService.getRealizedPnL(user.getUserId()));
            writer.printf("Total Return:        %.2f%%%n", portfolioService.getTotalReturnPercent(user));
            writer.printf("Total Trades:        %d%n", user.getTotalTrades());
            writer.printf("Total Commission:    $%,.2f%n", txService.getTotalCommissionPaid(user.getUserId()));
            writer.println("Portfolio Rating:  " + portfolioService.getPortfolioRating(user));
            writer.println();

            // Recent Transactions
            writer.println("══════════════════════ RECENT TRANSACTIONS ══════════════");
            List<Transaction> recent = txService.getRecentTransactions(user.getUserId(), 20);
            if (recent.isEmpty()) {
                writer.println("No transactions yet.");
            } else {
                writer.printf("%-10s %-20s %-5s %-6s %6s %10s %10s%n",
                    "TxID", "Timestamp", "Type", "Symbol", "Qty", "Price", "P&L");
                writer.println("-".repeat(75));
                for (Transaction tx : recent) {
                    writer.printf("%-10s %-20s %-5s %-6s %6d %10.2f %10.2f%n",
                        tx.getTransactionId(), tx.getFormattedTimestamp(),
                        tx.getType(), tx.getSymbol(), tx.getQuantity(),
                        tx.getPricePerShare(), tx.getProfitLoss());
                }
            }
        }
        System.out.println("✓ Full report saved to: " + filename);
    }

    public boolean dataDirectoryExists() {
        return Files.exists(Paths.get(DATA_DIR));
    }

    private String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max - 2) + ".." : s;
    }
}
