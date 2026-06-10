

package model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * User's personal stock watchlist
 */
public class Watchlist {
    private final String userId;
    private final List<String> symbols;

    public Watchlist(String userId) {
        this.userId = userId;
        this.symbols = new ArrayList<>();
    }

    public void add(String symbol) {
        if (!symbols.contains(symbol.toUpperCase()))
            symbols.add(symbol.toUpperCase());
    }

    public void remove(String symbol) {
        symbols.remove(symbol.toUpperCase());
    }

    public boolean contains(String symbol) {
        return symbols.contains(symbol.toUpperCase());
    }

    public List<String> getSymbols() { return Collections.unmodifiableList(symbols); }
    public String getUserId() { return userId; }
    public boolean isEmpty() { return symbols.isEmpty(); }
    public int size() { return symbols.size(); }
}
