import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Box,
  CircularProgress,
  Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { deleteStore } from '../services/api';

const getStatusColor = (status) => {
  switch (status) {
    case 'Ready':
      return 'success';
    case 'Provisioning':
      return 'warning';
    case 'Failed':
      return 'error';
    default:
      return 'default';
  }
};

function StoreCard({ store, onDelete }) {
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete store "${store.name}"?`)) {
      setDeleting(true);
      try {
        await deleteStore(store.id);
        onDelete();
      } catch (error) {
        alert(`Failed to delete store: ${error.message}`);
        setDeleting(false);
      }
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Typography variant="h5" component="div">
            {store.name}
          </Typography>
          <Box>
            <Chip 
              label={store.status} 
              color={getStatusColor(store.status)} 
              size="small"
              sx={{ mr: 1 }}
            />
            <IconButton 
              size="small" 
              onClick={handleDelete}
              disabled={deleting}
              color="error"
            >
              {deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
            </IconButton>
          </Box>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Created: {new Date(store.createdAt).toLocaleString()}
        </Typography>
        
        {store.url && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<OpenInNewIcon />}
            href={store.url}
            target="_blank"
            disabled={store.status !== 'Ready'}
          >
            Open Store
          </Button>
        )}
        
        {store.adminUrl && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<OpenInNewIcon />}
            href={store.adminUrl}
            target="_blank"
            disabled={store.status !== 'Ready'}
            sx={{ ml: 1 }}
          >
            Admin Panel
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StoreList({ stores, loading, onRefresh }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Your Stores
        </Typography>
        <IconButton onClick={onRefresh} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {loading && stores.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              No stores yet. Click the "Create New Store" button to get started!
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {stores.map((store) => (
            <Grid item xs={12} md={6} lg={4} key={store.id}>
              <StoreCard store={store} onDelete={onRefresh} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default StoreList;
