

package model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Represents a publicly traded stock with real-time price simulation
 */
public class Stock {
    private final String symbol;
    private final String companyName;
    private final String sector;
    private double currentPrice;
    private double openPrice;
    private double previousClose;
    private double dayHigh;
    private double dayLow;
    private double yearHigh;
    private double yearLow;
    private long volume;
    private double marketCap;
    private double peRatio;
    private double dividendYield;
    private final List<PriceHistory> priceHistory;
    private StockStatus status;

    public enum StockStatus { ACTIVE, HALTED, SUSPENDED }

    public Stock(String symbol, String companyName, String sector,
                 double initialPrice, double peRatio, double dividendYield) {
        this.symbol = symbol.toUpperCase();
        this.companyName = companyName;
        this.sector = sector;
        this.currentPrice = initialPrice;
        this.openPrice = initialPrice;
        this.previousClose = initialPrice * (1 - (Math.random() * 0.02 - 0.01));
        this.dayHigh = initialPrice;
        this.dayLow = initialPrice;
        this.yearHigh = initialPrice * (1 + Math.random() * 0.30);
        this.yearLow = initialPrice * (1 - Math.random() * 0.25);
        this.volume = (long)(Math.random() * 10_000_000) + 100_000;
        this.marketCap = initialPrice * ((long)(Math.random() * 1_000_000_000) + 10_000_000);
        this.peRatio = peRatio;
        this.dividendYield = dividendYield;
        this.priceHistory = new ArrayList<>();
        this.status = StockStatus.ACTIVE;
        recordPrice(initialPrice);
    }

    // Simulate price movement based on market sentiment and sector volatility
    public void simulatePriceChange(double marketSentiment) {
        if (status != StockStatus.ACTIVE) return;
        
        // Base volatility based on sector/symbol
        double baseVolatility = 0.01; // 1% default
        if (sector.equalsIgnoreCase("Technology") || symbol.equals("TSLA")) {
            baseVolatility = 0.025; // 2.5% tech/TSLA volatility
        } else if (sector.equalsIgnoreCase("Consumer") || sector.equalsIgnoreCase("Healthcare")) {
            baseVolatility = 0.008; // 0.8% defensive volatility
        } else if (symbol.equals("SPY")) {
            baseVolatility = 0.004; // 0.4% ETF index volatility
        }
        
        // Stock specific drift (random walk with momentum)
        double stockDrift = (Math.random() * 2 - 1) * baseVolatility;
        
        // Market sentiment effect (biases drift direction)
        double sentimentEffect = marketSentiment * baseVolatility * 0.5;
        
        double changePercent = stockDrift + sentimentEffect;
        
        // Cap single tick change to +/- 5%
        changePercent = Math.max(-0.05, Math.min(0.05, changePercent));
        
        double change = changePercent * currentPrice;
        double newPrice = Math.max(0.01, currentPrice + change);
        updatePrice(newPrice);
    }

    public void updatePrice(double newPrice) {
        this.currentPrice = Math.round(newPrice * 100.0) / 100.0;
        this.dayHigh = Math.max(dayHigh, currentPrice);
        this.dayLow = Math.min(dayLow, currentPrice);
        this.volume += (long)(Math.random() * 50000);
        recordPrice(currentPrice);
    }

    private void recordPrice(double price) {
        priceHistory.add(new PriceHistory(price, LocalDateTime.now()));
        if (priceHistory.size() > 100) priceHistory.remove(0);
    }

    public double getDayChangePercent() {
        if (previousClose == 0) return 0;
        return ((currentPrice - previousClose) / previousClose) * 100;
    }

    public double getDayChangeAmount() {
        return currentPrice - previousClose;
    }

    public String getChangeIndicator() {
        double change = getDayChangePercent();
        if (change > 0) return "▲";
        if (change < 0) return "▼";
        return "─";
    }

    // Getters
    public String getSymbol() { return symbol; }
    public String getCompanyName() { return companyName; }
    public String getSector() { return sector; }
    public double getCurrentPrice() { return currentPrice; }
    public double getOpenPrice() { return openPrice; }
    public double getPreviousClose() { return previousClose; }
    public double getDayHigh() { return dayHigh; }
    public double getDayLow() { return dayLow; }
    public double getYearHigh() { return yearHigh; }
    public double getYearLow() { return yearLow; }
    public long getVolume() { return volume; }
    public double getMarketCap() { return marketCap; }
    public double getPeRatio() { return peRatio; }
    public double getDividendYield() { return dividendYield; }
    public List<PriceHistory> getPriceHistory() { return new ArrayList<>(priceHistory); }
    public StockStatus getStatus() { return status; }
    public void setStatus(StockStatus status) { this.status = status; }

    @Override
    public String toString() {
        return String.format("%s (%s)", companyName, symbol);
    }
}
