

package service;

import model.Stock;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages the stock market data, live price simulation, and market indices
 */
public class MarketService {
    private final Map<String, Stock> stocks;
    private boolean marketOpen;
    private double marketSentiment; // -1.0 to 1.0, affects overall price direction

    public MarketService() {
        this.stocks = new LinkedHashMap<>();
        this.marketOpen = true;
        this.marketSentiment = 0.0;
    }

    public void seedMarket() {
        // Technology
        addStock(new Stock("AAPL", "Apple Inc.", "Technology", 185.50, 28.5, 0.54));
        addStock(new Stock("MSFT", "Microsoft Corporation", "Technology", 420.30, 35.2, 0.72));
        addStock(new Stock("GOOGL", "Alphabet Inc.", "Technology", 175.80, 25.1, 0.0));
        addStock(new Stock("META", "Meta Platforms Inc.", "Technology", 520.00, 22.8, 0.44));
        addStock(new Stock("NVDA", "NVIDIA Corporation", "Technology", 875.25, 65.3, 0.04));
        addStock(new Stock("AMZN", "Amazon.com Inc.", "Technology", 210.40, 45.7, 0.0));

        // Finance
        addStock(new Stock("JPM", "JPMorgan Chase & Co.", "Finance", 205.60, 12.3, 2.40));
        addStock(new Stock("BAC", "Bank of America Corp.", "Finance", 38.90, 11.5, 2.85));
        addStock(new Stock("GS", "Goldman Sachs Group", "Finance", 495.20, 14.8, 1.98));

        // Healthcare
        addStock(new Stock("JNJ", "Johnson & Johnson", "Healthcare", 155.30, 15.2, 3.25));
        addStock(new Stock("PFE", "Pfizer Inc.", "Healthcare", 28.75, 9.8, 6.15));
        addStock(new Stock("UNH", "UnitedHealth Group", "Healthcare", 520.80, 21.4, 1.55));

        // Energy
        addStock(new Stock("XOM", "ExxonMobil Corporation", "Energy", 112.45, 13.6, 3.45));
        addStock(new Stock("CVX", "Chevron Corporation", "Energy", 156.20, 14.2, 4.12));

        // Consumer
        addStock(new Stock("TSLA", "Tesla Inc.", "Consumer", 245.60, 55.3, 0.0));
        addStock(new Stock("WMT", "Walmart Inc.", "Consumer", 68.40, 27.8, 1.24));
        addStock(new Stock("KO", "Coca-Cola Company", "Consumer", 62.15, 23.5, 3.18));

        // Telecom
        addStock(new Stock("T", "AT&T Inc.", "Telecom", 17.85, 7.2, 6.72));
        addStock(new Stock("VZ", "Verizon Communications", "Telecom", 41.20, 8.5, 6.55));

        // ETF/Index
        addStock(new Stock("SPY", "SPDR S&P 500 ETF", "ETF", 520.00, 22.0, 1.35));

        System.out.printf("✓ Market initialized with %d stocks across multiple sectors%n", stocks.size());
    }

    private void addStock(Stock stock) {
        stocks.put(stock.getSymbol(), stock);
    }

    public void refreshMarketPrices() {
        if (!marketOpen) return;
        // Simulate slight market-wide sentiment shifts
        marketSentiment += (Math.random() * 0.04 - 0.02);
        marketSentiment = Math.max(-0.5, Math.min(0.5, marketSentiment));

        for (Stock stock : stocks.values()) {
            stock.simulatePriceChange(marketSentiment);
        }
    }

    public Optional<Stock> getStock(String symbol) {
        return Optional.ofNullable(stocks.get(symbol.toUpperCase()));
    }

    public List<Stock> getAllStocks() {
        return new ArrayList<>(stocks.values());
    }

    public List<Stock> getStocksBySector(String sector) {
        return stocks.values().stream()
            .filter(s -> s.getSector().equalsIgnoreCase(sector))
            .collect(Collectors.toList());
    }

    public List<String> getAllSectors() {
        return stocks.values().stream()
            .map(Stock::getSector)
            .distinct()
            .sorted()
            .collect(Collectors.toList());
    }

    public List<Stock> getTopGainers(int limit) {
        return stocks.values().stream()
            .sorted((a, b) -> Double.compare(b.getDayChangePercent(), a.getDayChangePercent()))
            .limit(limit)
            .collect(Collectors.toList());
    }

    public List<Stock> getTopLosers(int limit) {
        return stocks.values().stream()
            .sorted(Comparator.comparingDouble(Stock::getDayChangePercent))
            .limit(limit)
            .collect(Collectors.toList());
    }

    public List<Stock> getMostActive(int limit) {
        return stocks.values().stream()
            .sorted((a, b) -> Long.compare(b.getVolume(), a.getVolume()))
            .limit(limit)
            .collect(Collectors.toList());
    }

    public List<Stock> searchStocks(String query) {
        String q = query.toLowerCase();
        return stocks.values().stream()
            .filter(s -> s.getSymbol().toLowerCase().contains(q)
                      || s.getCompanyName().toLowerCase().contains(q)
                      || s.getSector().toLowerCase().contains(q))
            .collect(Collectors.toList());
    }

    public double getMarketIndex() {
        return stocks.values().stream()
            .mapToDouble(s -> s.getCurrentPrice() * (s.getMarketCap() / 1e12))
            .sum();
    }

    public boolean isStockAvailable(String symbol) {
        Optional<Stock> s = getStock(symbol);
        return s.isPresent() && s.get().getStatus() == Stock.StockStatus.ACTIVE;
    }

    public Map<String, Stock> getStockMap() { return Collections.unmodifiableMap(stocks); }
    public boolean isMarketOpen() { return marketOpen; }
    public void setMarketOpen(boolean open) { this.marketOpen = open; }
    public double getMarketSentiment() { return marketSentiment; }
}
