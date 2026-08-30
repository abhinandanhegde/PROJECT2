"""
Deterministic tests for the dependency-graph blocking impact computation.
"""

from app.routers.relationships import compute_blocking_impact


def _edge(source, target, rtype="blocks"):
    return {
        "source_bug_id": source,
        "target_bug_id": target,
        "relationship_type": rtype,
    }


class TestComputeBlockingImpact:
    def test_empty_input(self):
        b, u, path = compute_blocking_impact([], [])
        assert b == {}
        assert u == {}
        assert path == []

    def test_related_edges_have_no_blocking_impact(self):
        ids = ["a", "b", "c"]
        edges = [_edge("a", "b", "related_to"), _edge("b", "c", "related_to")]
        b, u, path = compute_blocking_impact(ids, edges)
        assert all(v == 0 for v in b.values())
        assert all(v == 0 for v in u.values())
        assert path == []

    def test_depends_on_is_normalized_to_a_blocking_edge(self):
        # a depends on b, so resolving b unblocks a.
        b, u, path = compute_blocking_impact(["a", "b"], [_edge("a", "b", "depends_on")])
        assert b == {"a": 0, "b": 1}
        assert u == {"a": 1, "b": 0}
        assert path == ["b", "a"]

    def test_simple_chain(self):
        ids = ["a", "b", "c"]
        edges = [_edge("a", "b"), _edge("b", "c")]
        b, u, path = compute_blocking_impact(ids, edges)
        assert b["a"] == 2
        assert b["b"] == 1
        assert b["c"] == 0
        assert u["a"] == 0
        assert u["b"] == 1
        assert u["c"] == 2
        assert path == ["a", "b", "c"]

    def test_fork_counts_and_path(self):
        ids = ["a", "b", "c", "d"]
        edges = [_edge("a", "b"), _edge("a", "c"), _edge("b", "d")]
        b, u, path = compute_blocking_impact(ids, edges)
        assert b["a"] == 3  # b, c, d
        assert b["b"] == 1
        assert b["c"] == 0
        assert b["d"] == 0
        assert u["d"] == 2  # a, b
        # Longest chain is a -> b -> d
        assert path == ["a", "b", "d"]

    def test_cycle_terminates(self):
        ids = ["a", "b"]
        edges = [_edge("a", "b"), _edge("b", "a")]
        b, u, path = compute_blocking_impact(ids, edges)
        assert b == {"a": 1, "b": 1}
        assert u == {"a": 1, "b": 1}
        assert path == []  # A cycle is a deadlock, not a valid critical path.

    def test_edges_to_hidden_nodes_ignored(self):
        # 'z' is not visible, so an edge a -> z contributes nothing.
        ids = ["a", "b"]
        edges = [_edge("a", "z"), _edge("a", "b")]
        b, u, path = compute_blocking_impact(ids, edges)
        assert b["a"] == 1
        assert "z" not in b
        assert path == ["a", "b"]

    def test_self_edge_ignored(self):
        ids = ["a"]
        edges = [_edge("a", "a")]
        b, u, path = compute_blocking_impact(ids, edges)
        assert b["a"] == 0
        assert path == []

    def test_deterministic_tie_break(self):
        # Two projects each with a 3-node chain; the root that unblocks more
        # (a-root chain has an extra downstream bug) must win.
        ids = ["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2"]
        edges = [
            _edge("a1", "a2"),
            _edge("a2", "a3"),
            _edge("a1", "c1"),
            _edge("c1", "c2"),
            _edge("b1", "b2"),
            _edge("b2", "b3"),
        ]
        b, u, path = compute_blocking_impact(ids, edges)
        # Chain a1 -> a2 -> a3 (len 3) == b1 -> b2 -> b3 (len 3), but a1
        # unblocks 4 (a2, a3, c1, c2) vs b1's 2 — so a1's chain wins.
        assert path == ["a1", "a2", "a3"]
        assert b["a1"] == 4
