
package main;

import model.*;
import service.*;
import ui.TradingConsoleUI;

/**
 * Main entry point for the Stock Trading Platform
 * Initializes services and launches the console UI
 */
public class Main {
    public static void main(String[] args) {
        System.out.println("╔══════════════════════════════════════════╗");
        System.out.println("║     APEX STOCK TRADING PLATFORM v1.0     ║");
        System.out.println("║         Professional Trading Suite        ║");
        System.out.println("╚══════════════════════════════════════════╝");
        System.out.println();

        // Initialize core services
        MarketService marketService = new MarketService();
        UserService userService = new UserService();
        TransactionService transactionService = new TransactionService();
        PortfolioService portfolioService = new PortfolioService(marketService);
        AlertService alertService = new AlertService(marketService);
        FileIOService fileIOService = new FileIOService();

        // Seed market with demo stocks
        marketService.seedMarket();

        // Launch UI
        TradingConsoleUI ui = new TradingConsoleUI(
            marketService, userService, transactionService,
            portfolioService, alertService, fileIOService
        );
        ui.start();
    }
}
