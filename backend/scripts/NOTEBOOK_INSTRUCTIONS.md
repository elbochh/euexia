# How to Update SageMaker Instance Types from Jupyter Notebook

## Quick Start

1. **Open SageMaker Studio** → Create/Open a Jupyter notebook
2. **Copy the cells** from `sagemaker_update_from_notebook.py` (each `# CELL X` section is a separate notebook cell)
3. **Run cells sequentially**

## Step-by-Step Guide

### Step 1: List All Endpoints

Copy **CELL 1** from `sagemaker_update_from_notebook.py` into your notebook and run it.

This will show:
- All your endpoints
- Current instance types
- Monthly costs for each
- Total monthly cost

### Step 2: Configure Update

Copy **CELL 2** and modify these lines:

```python
ENDPOINT_NAME = 'your-endpoint-name'  # ⬅️ Change this
NEW_INSTANCE_TYPE = 'ml.g5.xlarge'    # ⬅️ Change this
```

**Recommended instance types:**
- `ml.g5.xlarge` - 50% cheaper, good performance
- `ml.g4dn.xlarge` - 62% cheaper, good for vision
- `ml.t3.xlarge` - 85% cheaper, for light workloads

### Step 3: Create New Configuration

Copy **CELL 3** and run it. This creates a new endpoint configuration with the new instance type.

### Step 4: Update Endpoint

Copy **CELL 4** and run it. This starts the endpoint update.

⚠️ **Warning**: The endpoint will be unavailable for 10-20 minutes during update.

### Step 5: Monitor Status (Optional)

Copy **CELL 5** to watch the update progress in real-time. Press Ctrl+C to stop monitoring.

### Step 6: Calculate Savings

Copy **CELL 6** to see your cost savings.

## Alternative: Use AWS Console

If you prefer the console:

1. Go to **SageMaker → Inference → Endpoints**
2. Click your endpoint
3. Click **Update endpoint**
4. Select new instance type
5. Click **Update**

## Example: Complete Notebook

Here's a minimal example you can copy directly:

```python
# Cell 1: Setup
import boto3
sagemaker = boto3.client('sagemaker', region_name='us-east-1')

# Cell 2: List endpoints
endpoints = sagemaker.list_endpoints()['Endpoints']
for ep in endpoints:
    print(ep['EndpointName'], ep['EndpointStatus'])

# Cell 3: Get current config
endpoint_name = 'your-endpoint-name'  # Change this
endpoint = sagemaker.describe_endpoint(EndpointName=endpoint_name)
config = sagemaker.describe_endpoint_config(
    EndpointConfigName=endpoint['EndpointConfigName']
)
print(f"Current instance: {config['ProductionVariants'][0]['InstanceType']}")

# Cell 4: Create new config
new_instance = 'ml.g5.xlarge'  # Change this
new_config_name = f"{endpoint['EndpointConfigName']}-{new_instance.replace('.', '-')}"
variants = config['ProductionVariants']
variants[0]['InstanceType'] = new_instance

sagemaker.create_endpoint_config(
    EndpointConfigName=new_config_name,
    ProductionVariants=variants
)

# Cell 5: Update endpoint
sagemaker.update_endpoint(
    EndpointName=endpoint_name,
    EndpointConfigName=new_config_name
)
print("Update started! Check status in console.")
```

## Tips

- **Test one endpoint first** before updating all
- **Monitor performance** after update (check CloudWatch metrics)
- **Use auto-scaling** to scale to zero during idle times
- **Consider serverless inference** for low-traffic endpoints

## Need Help?

Check `SAGEMAKER_COST_OPTIMIZATION.md` for detailed cost optimization strategies.
